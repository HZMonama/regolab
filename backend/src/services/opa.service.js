import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Cache the resolved OPA executable path and opavm status
let opaExecutable = null;
let opavmAvailable = null;
let opavmOpaPath = null;

/**
 * Check if opavm is available in PATH
 * @returns {Promise<boolean>}
 */
async function isOpavmAvailable() {
  if (opavmAvailable !== null) {
    return opavmAvailable;
  }

  try {
    await execAsync('opavm current', { timeout: 5000 });
    opavmAvailable = true;
    return true;
  } catch {
    opavmAvailable = false;
    return false;
  }
}

/**
 * Find .opa-version file by walking up directory tree
 * @param {string} startDir - Directory to start searching from
 * @returns {Promise<string|null>} - Path to .opa-version file or null
 */
async function findOpaVersionFile(startDir) {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const versionFile = path.join(currentDir, '.opa-version');
    try {
      await fs.access(versionFile);
      return versionFile;
    } catch {
      // File doesn't exist, continue to parent
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return null;
}

/**
 * Read the pinned OPA version from .opa-version file
 * @param {string} startDir - Directory to start searching from
 * @returns {Promise<{version: string, source: string}|null>}
 */
async function getPinnedOpaVersion(startDir) {
  const versionFile = await findOpaVersionFile(startDir);
  if (!versionFile) {
    return null;
  }

  try {
    const content = await fs.readFile(versionFile, 'utf-8');
    const version = content.trim();
    if (version) {
      return {
        version,
        source: `pinned via ${path.relative(process.cwd(), versionFile) || '.opa-version'}`
      };
    }
  } catch (error) {
    console.warn(`Warning: Failed to read .opa-version file: ${error.message}`);
  }

  return null;
}

/**
 * Get OPA path using opavm
 * @param {string|null} workingDir - Working directory for version resolution
 * @returns {Promise<{path: string, version: string, source: string}|null>}
 */
async function getOpaPathViaOpavm(workingDir = null) {
  if (!await isOpavmAvailable()) {
    return null;
  }

  const cwd = workingDir || process.cwd();

  // Check if there's a pinned version
  const pinned = await getPinnedOpaVersion(cwd);

  try {
    // Use opavm which to get the binary path
    const { stdout } = await execAsync('opavm which', {
      timeout: 10000,
      cwd
    });
    const binaryPath = stdout.trim();

    if (binaryPath) {
      // Verify the binary exists
      await fs.access(binaryPath);

      // Get version info from opa
      const { stdout: versionOutput } = await execAsync(`"${binaryPath}" version`, { timeout: 5000 });
      const versionMatch = versionOutput.match(/Version:\s*(\S+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        path: binaryPath,
        version,
        source: pinned ? pinned.source : 'global default (via opavm)'
      };
    }
  } catch (error) {
    // opavm which might fail if no version is configured
    if (error.message?.includes('not installed') || error.message?.includes('not configured')) {
      console.log('opavm: No OPA version configured, falling back to other sources');
    } else {
      console.warn(`Warning: opavm which failed: ${error.message}`);
    }
  }

  return null;
}

/**
 * Find the OPA executable path
 * Checks multiple locations in order of priority
 * @param {string|null} workingDir - Working directory for version resolution
 * @returns {Promise<string>} Path to OPA executable
 */
async function findOpaExecutable(workingDir = null) {
  if (opaExecutable) {
    return opaExecutable;
  }

  // Priority 1: Check for opavm-managed OPA
  const opavmPath = await getOpaPathViaOpavm(workingDir);
  if (opavmPath) {
    opaExecutable = opavmPath.path;
    console.log(`Found OPA via opavm: ${opaExecutable} (${opavmPath.source}, version ${opavmPath.version})`);
    return opaExecutable;
  }

  // Priority 2: Environment variable override
  if (process.env.OPA_PATH) {
    try {
      await fs.access(process.env.OPA_PATH, fs.constants.X_OK).catch(() => fs.access(process.env.OPA_PATH));
      opaExecutable = process.env.OPA_PATH;
      console.log(`Found OPA via OPA_PATH: ${opaExecutable}`);
      return opaExecutable;
    } catch {
      console.warn(`Warning: OPA_PATH set to ${process.env.OPA_PATH} but file not accessible`);
    }
  }

  // Priority 3: Standard locations
  const candidates = [
    // Docker container location (Linux)
    '/usr/local/bin/opa',
    // Common Windows locations
    'C:\\Tools\\OPA\\opa.exe',
    'C:\\Program Files\\OPA\\opa.exe',
    // Fall back to PATH lookup
    process.platform === 'win32' ? 'opa.exe' : 'opa',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      // Check if file exists for absolute paths
      if (path.isAbsolute(candidate)) {
        await fs.access(candidate, fs.constants.X_OK).catch(() => fs.access(candidate));
        opaExecutable = candidate;
        console.log(`Found OPA at: ${opaExecutable}`);
        return opaExecutable;
      }

      // For non-absolute paths, try running it
      await execAsync(`"${candidate}" version`, { timeout: 5000 });
      opaExecutable = candidate;
      console.log(`Found OPA in PATH: ${opaExecutable}`);
      return opaExecutable;
    } catch {
      // Continue to next candidate
    }
  }

  throw new Error(
    'OPA executable not found. Install OPA via opavm (`pip install opavm && opavm install latest`) ' +
    'or set OPA_PATH environment variable.'
  );
}

/**
 * Execute OPA command, optionally using opavm exec
 * @param {string[]} args - OPA arguments
 * @param {object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function execOpa(args, options = {}) {
  const cwd = options.cwd || process.cwd();
  const timeout = options.timeout || 30000;

  // Check if we should use opavm exec
  if (await isOpavmAvailable()) {
    // Check if there's a pinned version file
    const hasPinnedVersion = await findOpaVersionFile(cwd);

    if (hasPinnedVersion) {
      // Use opavm exec to ensure correct version is used
      const cmd = `opavm exec -- ${args.join(' ')}`;
      return execAsync(cmd, { timeout, cwd });
    }
  }

  // Fall back to direct OPA execution
  const opa = await findOpaExecutable(cwd);
  const cmd = `"${opa}" ${args.join(' ')}`;
  return execAsync(cmd, { timeout, cwd });
}

/**
 * Evaluate a policy using OPA CLI
 * @param {string} policy - The Rego policy content
 * @param {string} input - The input JSON
 * @param {string} data - The data JSON
 * @returns {Promise<object>} Evaluation result
 */
export async function evaluatePolicy(policy, input, data) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opa-eval-'));

  try {
    // Write files
    const policyPath = path.join(tempDir, 'policy.rego');
    const inputPath = path.join(tempDir, 'input.json');
    const dataPath = path.join(tempDir, 'data.json');

    await Promise.all([
      fs.writeFile(policyPath, policy),
      fs.writeFile(inputPath, input),
      fs.writeFile(dataPath, data),
    ]);

    // Run opa eval with JSON output
    const { stdout, stderr } = await execOpa(
      ['eval', '-d', policyPath, '-d', dataPath, '-i', inputPath, '--format', 'json', 'data'],
      { cwd: tempDir, timeout: 30000 }
    ).catch((error) => {
      // OPA eval may return non-zero for policy errors
      if (error.stderr) {
        throw new Error(error.stderr.trim());
      }
      throw error;
    });

    // Parse JSON output
    let result;
    try {
      result = JSON.parse(stdout || '{}');
    } catch (parseError) {
      console.error('Failed to parse OPA eval output:', stdout);
      if (stderr) {
        throw new Error(stderr.trim());
      }
      throw new Error(`Failed to parse evaluation results: ${parseError.message}`);
    }

    // OPA eval returns { result: [{ expressions: [{ value: ... }] }] }
    // Extract the actual result value
    if (result.result && result.result[0] && result.result[0].expressions) {
      return { result: result.result[0].expressions[0].value };
    }

    return { result: result };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function formatPolicy(policy) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opa-fmt-'));

  try {
    const policyPath = path.join(tempDir, 'policy.rego');
    await fs.writeFile(policyPath, policy);

    // opa fmt outputs the formatted code to stdout
    const { stdout } = await execOpa(['fmt', policyPath], { cwd: tempDir, timeout: 10000 });
    return stdout;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Get OPA version info
 * @returns {Promise<{available: boolean, version: string|null, path: string|null, source?: string}>}
 */
export async function getOpaVersion() {
  try {
    // Try opavm first for detailed info
    const opavmPath = await getOpaPathViaOpavm();
    if (opavmPath) {
      return {
        available: true,
        version: opavmPath.version,
        path: opavmPath.path,
        source: opavmPath.source,
      };
    }

    const opa = await findOpaExecutable();
    const { stdout } = await execAsync(`"${opa}" version`, { timeout: 5000 });

    // Parse version from output like "Version: 1.10.1"
    const versionMatch = stdout.match(/Version:\s*(\S+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    return {
      available: true,
      version,
      path: opa,
    };
  } catch (error) {
    return {
      available: false,
      version: null,
      path: null,
      error: error.message,
    };
  }
}

/**
 * Run OPA tests
 * @param {string} policy - The main policy content
 * @param {string} testPolicy - The test policy content (*_test.rego)
 * @param {string} data - Optional data JSON
 * @returns {Promise<{results: Array, summary: {pass: number, fail: number, error: number, skip: number}}>}
 */
export async function testPolicy(policy, testPolicy, data = '{}') {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opa-test-'));

  try {
    // Write policy file
    const policyPath = path.join(tempDir, 'policy.rego');
    await fs.writeFile(policyPath, policy);

    // Write test file
    const testPath = path.join(tempDir, 'policy_test.rego');
    await fs.writeFile(testPath, testPolicy);

    // Write data file if provided
    if (data && data !== '{}') {
      const dataPath = path.join(tempDir, 'data.json');
      await fs.writeFile(dataPath, data);
    }

    // Run opa test with JSON output and verbose mode
    const { stdout, stderr } = await execOpa(
      ['test', tempDir, '--format', 'json', '-v'],
      { cwd: tempDir, timeout: 30000 }
    ).catch((error) => {
      // OPA test returns non-zero exit code when tests fail
      // but stdout still contains the JSON results
      if (error.stdout) {
        return { stdout: error.stdout, stderr: error.stderr || '' };
      }
      throw error;
    });

    // Parse JSON output
    let results = [];
    try {
      results = JSON.parse(stdout || '[]');
    } catch (parseError) {
      console.error('Failed to parse OPA test output:', stdout);
      // Try to extract error message from stderr
      if (stderr) {
        throw new Error(stderr.trim());
      }
      throw new Error(`Failed to parse test results: ${parseError.message}`);
    }

    // Calculate summary
    const summary = {
      pass: 0,
      fail: 0,
      error: 0,
      skip: 0,
      total: results.length,
    };

    for (const result of results) {
      if (result.skip) {
        summary.skip++;
      } else if (result.error) {
        summary.error++;
      } else if (result.fail) {
        summary.fail++;
      } else {
        summary.pass++;
      }
    }

    return { results, summary };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Get detailed opavm status information
 * @returns {Promise<{available: boolean, which: string|null, current: string|null}>}
 */
export async function getOpavmStatus() {
  const available = await isOpavmAvailable();

  if (!available) {
    return {
      available: false,
      which: null,
      current: null,
    };
  }

  try {
    // Get which output
    const { stdout: whichOutput } = await execAsync('opavm which', { timeout: 5000 }).catch(() => ({ stdout: '' }));

    // Get current version
    const { stdout: currentOutput } = await execAsync('opavm current', { timeout: 5000 }).catch(() => ({ stdout: '' }));

    return {
      available: true,
      which: whichOutput.trim() || null,
      current: currentOutput.trim() || null,
    };
  } catch {
    return {
      available: true,
      which: null,
      current: null,
    };
  }
}

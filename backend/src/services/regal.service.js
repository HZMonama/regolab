import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Cache the resolved regal executable path and opavm status
let regalExecutable = null;
let opavmAvailable = null;

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
 * Find .regal-version file by walking up directory tree
 * @param {string} startDir - Directory to start searching from
 * @returns {Promise<string|null>} - Path to .regal-version file or null
 */
async function findRegalVersionFile(startDir) {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const versionFile = path.join(currentDir, '.regal-version');
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
 * Get Regal path using opavm
 * @param {string|null} workingDir - Working directory for version resolution
 * @returns {Promise<{path: string, version: string, source: string}|null>}
 */
async function getRegalPathViaOpavm(workingDir = null) {
  if (!await isOpavmAvailable()) {
    return null;
  }

  const cwd = workingDir || process.cwd();

  try {
    // Use opavm which to get the binary path
    const { stdout } = await execAsync('opavm which --tool regal', {
      timeout: 10000,
      cwd
    });
    const binaryPath = stdout.trim();

    if (binaryPath) {
      // Verify the binary exists
      await fs.access(binaryPath);

      // Get version info from regal
      const { stdout: versionOutput } = await execAsync(`"${binaryPath}" version`, { timeout: 5000 });
      const versionMatch = versionOutput.match(/v?(\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      // Check if there's a pinned version
      const versionFile = await findRegalVersionFile(cwd);
      const source = versionFile
        ? `pinned via ${path.relative(process.cwd(), versionFile) || '.regal-version'}`
        : 'global default (via opavm)';

      return {
        path: binaryPath,
        version,
        source
      };
    }
  } catch (error) {
    // opavm which might fail if no version is configured
    if (error.message?.includes('not installed') || error.message?.includes('not configured')) {
      console.log('opavm: No Regal version configured, falling back to other sources');
    } else {
      console.warn(`Warning: opavm which --tool regal failed: ${error.message}`);
    }
  }

  return null;
}

/**
 * Find the Regal executable path
 * Checks multiple locations in order of priority
 * @param {string|null} workingDir - Working directory for version resolution
 * @returns {Promise<string>} Path to regal executable
 */
async function findRegalExecutable(workingDir = null) {
  if (regalExecutable) {
    return regalExecutable;
  }

  // Priority 1: Check for opavm-managed Regal
  const opavmPath = await getRegalPathViaOpavm(workingDir);
  if (opavmPath) {
    regalExecutable = opavmPath.path;
    console.log(`Found Regal via opavm: ${regalExecutable} (${opavmPath.source}, version ${opavmPath.version})`);
    return regalExecutable;
  }

  // Priority 2: Environment variable override
  if (process.env.REGAL_PATH) {
    try {
      await fs.access(process.env.REGAL_PATH, fs.constants.X_OK).catch(() => fs.access(process.env.REGAL_PATH));
      regalExecutable = process.env.REGAL_PATH;
      console.log(`Found Regal via REGAL_PATH: ${regalExecutable}`);
      return regalExecutable;
    } catch {
      console.warn(`Warning: REGAL_PATH set to ${process.env.REGAL_PATH} but file not accessible`);
    }
  }

  // Priority 3: Standard locations
  const candidates = [
    // Docker container location (Linux)
    '/usr/local/bin/regal',
    // Common Windows locations
    'C:\\Tools\\Regal\\regal.exe',
    'C:\\Program Files\\Regal\\regal.exe',
    // Fall back to PATH lookup
    process.platform === 'win32' ? 'regal.exe' : 'regal',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      // Check if file exists for absolute paths
      if (path.isAbsolute(candidate)) {
        await fs.access(candidate, fs.constants.X_OK).catch(() => fs.access(candidate));
        regalExecutable = candidate;
        console.log(`Found Regal at: ${regalExecutable}`);
        return regalExecutable;
      }

      // For non-absolute paths, try running it
      await execAsync(`"${candidate}" version`, { timeout: 5000 });
      regalExecutable = candidate;
      console.log(`Found Regal in PATH: ${regalExecutable}`);
      return regalExecutable;
    } catch {
      // Continue to next candidate
    }
  }

  throw new Error(
    'Regal executable not found. Install Regal via opavm (`pip install opavm && opavm install regal latest`) ' +
    'or set REGAL_PATH environment variable.'
  );
}

/**
 * Execute Regal command, optionally using opavm exec
 * @param {string[]} args - Regal arguments
 * @param {object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function execRegal(args, options = {}) {
  const cwd = options.cwd || process.cwd();
  const timeout = options.timeout || 15000;

  // Check if we should use opavm exec
  if (await isOpavmAvailable()) {
    // Check if there's a pinned version file
    const hasPinnedVersion = await findRegalVersionFile(cwd);

    if (hasPinnedVersion) {
      // Use opavm exec to ensure correct version is used
      const cmd = `opavm exec --tool regal -- ${args.join(' ')}`;
      return execAsync(cmd, { timeout, cwd });
    }
  }

  // Fall back to direct Regal execution
  const regal = await findRegalExecutable(cwd);
  const cmd = `"${regal}" ${args.join(' ')}`;
  return execAsync(cmd, { timeout, cwd });
}

/**
 * Lint a Rego policy using Regal
 * @param {string} policy - The Rego policy content
 * @returns {Promise<{violations: Array, summary: object, parseError: string|null}>} Lint results
 */
export async function lintPolicy(policy) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'regal-'));
  const policyPath = path.join(tempDir, 'policy.rego');

  try {
    await fs.writeFile(policyPath, policy);

    // Run regal lint with JSON output
    // Regal returns exit code 0 for no violations, non-zero for violations or errors
    // We capture both stdout and stderr
    const { stdout, stderr } = await execRegal(
      ['lint', policyPath, '--format', 'json'],
      { cwd: tempDir, timeout: 15000 }
    ).catch((error) => {
      // Regal exits with code 3 when violations found, which throws an error
      // But stdout still contains the JSON output
      if (error.stdout) {
        return { stdout: error.stdout, stderr: error.stderr || '' };
      }
      // Regal exits with code 1 for parse errors - check stderr for details
      if (error.stderr) {
        // Parse error - return empty violations with parse error info
        return { stdout: '', stderr: error.stderr, parseError: true };
      }
      throw error;
    });

    // If we got a parse error, return empty results (policy is syntactically invalid)
    if (!stdout && stderr) {
      // Extract parse error info from stderr if available
      const parseErrorMatch = stderr.match(/(\d+:\d+):\s*(.+)/);
      return {
        violations: [],
        summary: {},
        aggregates: [],
        parseError: parseErrorMatch ? parseErrorMatch[2] : 'Parse error',
      };
    }

    // Parse JSON output
    let result;
    try {
      result = JSON.parse(stdout || '{"violations": []}');
    } catch (parseError) {
      // JSON parse failed - likely Regal printed an error instead of JSON
      console.warn('Failed to parse Regal JSON output, returning empty result:', stdout?.slice(0, 200));
      return {
        violations: [],
        summary: {},
        aggregates: [],
        parseError: 'Invalid policy syntax',
      };
    }

    return {
      violations: result.violations || [],
      summary: result.summary || {},
      aggregates: result.aggregates || [],
      parseError: null,
    };
  } finally {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Map Regal violations to CodeMirror diagnostic format
 * @param {Array} violations - Regal violations array
 * @returns {Array} CodeMirror-compatible diagnostics
 */
export function mapToDiagnostics(violations) {
  // Rules to ignore
  const ignoredRules = ['directory-package-mismatch'];

  return violations
    .filter((v) => !ignoredRules.includes(v.title))
    .map((v) => {
      const location = v.location || {};
      const row = location.row || 1;
      const col = location.col || 1;
      const textLength = location.text?.length || 1;

      return {
        from: {
          line: row,
          col: col,
        },
        to: {
          line: row,
          col: col + textLength,
        },
        severity: v.level === 'error' ? 'error' : 'warning',
        message: v.description || v.title || 'Unknown violation',
        source: `regal/${v.category || 'unknown'}/${v.title || 'unknown'}`,
        rule: v.title,
        category: v.category,
        documentation: v.documentation?.url || null,
      };
    });
}

/**
 * Check if Regal is available
 * @returns {Promise<{available: boolean, version: string|null, path: string|null, source?: string}>}
 */
export async function checkRegalAvailable() {
  try {
    // Try opavm first for detailed info
    const opavmPath = await getRegalPathViaOpavm();
    if (opavmPath) {
      return {
        available: true,
        version: opavmPath.version,
        path: opavmPath.path,
        source: opavmPath.source,
      };
    }

    const regal = await findRegalExecutable();
    const { stdout } = await execAsync(`"${regal}" version`, { timeout: 5000 });
    const versionMatch = stdout.match(/v?(\d+\.\d+\.\d+)/);

    return {
      available: true,
      version: versionMatch ? versionMatch[1] : 'unknown',
      path: regal,
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
 * Get detailed opavm status information for Regal
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
    const { stdout: whichOutput } = await execAsync('opavm which --tool regal', { timeout: 5000 }).catch(() => ({ stdout: '' }));

    // Get current version
    const { stdout: currentOutput } = await execAsync('opavm current --tool regal', { timeout: 5000 }).catch(() => ({ stdout: '' }));

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

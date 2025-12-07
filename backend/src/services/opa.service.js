import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Cache the resolved OPA executable path
let opaExecutable = null;

/**
 * Find the OPA executable path
 * Checks multiple locations in order of priority
 * @returns {Promise<string>} Path to OPA executable
 */
async function findOpaExecutable() {
  if (opaExecutable) {
    return opaExecutable;
  }

  // Locations to check (in order of priority)
  const candidates = [
    // Docker container location (Linux)
    '/usr/local/bin/opa',
    // Common Windows locations
    'C:\\Tools\\OPA\\opa.exe',
    'C:\\Program Files\\OPA\\opa.exe',
    process.env.OPA_PATH, // Environment variable override
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
    'OPA executable not found. Install OPA or set OPA_PATH environment variable. ' +
    'Checked: ' + candidates.join(', ')
  );
}

/**
 * Evaluate a policy using OPA CLI
 * @param {string} policy - The Rego policy content
 * @param {string} input - The input JSON
 * @param {string} data - The data JSON
 * @returns {Promise<object>} Evaluation result
 */
export async function evaluatePolicy(policy, input, data) {
  const opa = await findOpaExecutable();
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
    // Evaluate "data" to get all results from the policy
    const { stdout, stderr } = await execAsync(
      `"${opa}" eval -d "${policyPath}" -d "${dataPath}" -i "${inputPath}" --format json "data"`,
      { timeout: 30000 }
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
  const opa = await findOpaExecutable();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opa-fmt-'));

  try {
    const policyPath = path.join(tempDir, 'policy.rego');
    await fs.writeFile(policyPath, policy);

    // opa fmt outputs the formatted code to stdout
    const { stdout } = await execAsync(`"${opa}" fmt "${policyPath}"`, { timeout: 10000 });
    return stdout;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Get OPA version info
 * @returns {Promise<{available: boolean, version: string|null, path: string|null}>}
 */
export async function getOpaVersion() {
  try {
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
  const opa = await findOpaExecutable();
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
    const { stdout, stderr } = await execAsync(
      `"${opa}" test "${tempDir}" --format json -v`,
      { timeout: 30000 }
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
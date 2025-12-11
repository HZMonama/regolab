import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Cache the resolved regal executable path
let regalExecutable = null;

/**
 * Find the Regal executable path
 * Checks multiple locations in order of priority
 * @returns {Promise<string>} Path to regal executable
 */
async function findRegalExecutable() {
  if (regalExecutable) {
    return regalExecutable;
  }

  // Locations to check (in order of priority)
  const candidates = [
    // Docker container location (Linux)
    '/usr/local/bin/regal',
    // Common Windows locations
    'C:\\Tools\\Regal\\regal.exe',
    'C:\\Program Files\\Regal\\regal.exe',
    process.env.REGAL_PATH, // Environment variable override
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
    'Regal executable not found. Install Regal or set REGAL_PATH environment variable. ' +
    'Checked: ' + candidates.join(', ')
  );
}

/**
 * Lint a Rego policy using Regal
 * @param {string} policy - The Rego policy content
 * @returns {Promise<{violations: Array, summary: object, parseError: string|null}>} Lint results
 */
export async function lintPolicy(policy) {
  const regal = await findRegalExecutable();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'regal-'));
  const policyPath = path.join(tempDir, 'policy.rego');

  try {
    await fs.writeFile(policyPath, policy);

    // Run regal lint with JSON output
    // Regal returns exit code 0 for no violations, non-zero for violations or errors
    // We capture both stdout and stderr
    const { stdout, stderr } = await execAsync(
      `"${regal}" lint "${policyPath}" --format json`,
      { timeout: 15000 }
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
 * @returns {Promise<{available: boolean, version: string|null, path: string|null}>}
 */
export async function checkRegalAvailable() {
  try {
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

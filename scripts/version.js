#!/usr/bin/env node

/**
 * Semantic Version Management Script for RegoLab
 * 
 * Usage:
 *   node scripts/version.js bump major
 *   node scripts/version.js bump minor
 *   node scripts/version.js bump patch
 *   node scripts/version.js current
 * 
 * Or via npm scripts:
 *   npm run version bump patch
 *   npm run version current
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// File paths that need to be updated
const VERSION_FILE = join(ROOT_DIR, 'version.json');
const FRONTEND_PACKAGE_JSON = join(ROOT_DIR, 'frontend', 'package.json');
const APP_HEADER_FILE = join(ROOT_DIR, 'frontend', 'components', 'header', 'app-header.tsx');
const SETTINGS_CONTEXT_FILE = join(ROOT_DIR, 'frontend', 'lib', 'settings-context.tsx');
const BACKEND_VERSION_FILE = join(ROOT_DIR, 'backend', 'src', 'routes', 'version.js');

/**
 * Parse semantic version string
 */
function parseVersion(versionString) {
  const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${versionString}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Format version object to string
 */
function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

/**
 * Bump version based on type
 */
function bumpVersion(version, type) {
  const parsed = parseVersion(version);
  
  switch (type) {
    case 'major':
      parsed.major += 1;
      parsed.minor = 0;
      parsed.patch = 0;
      break;
    case 'minor':
      parsed.minor += 1;
      parsed.patch = 0;
      break;
    case 'patch':
      parsed.patch += 1;
      break;
    default:
      throw new Error(`Invalid bump type: ${type}. Must be 'major', 'minor', or 'patch'.`);
  }
  
  return formatVersion(parsed);
}

/**
 * Read current version from version.json
 */
function getCurrentVersion() {
  try {
    const content = readFileSync(VERSION_FILE, 'utf-8');
    const data = JSON.parse(content);
    return data.version;
  } catch (error) {
    throw new Error(`Failed to read version file: ${error.message}`);
  }
}

/**
 * Update version.json
 */
function updateVersionFile(newVersion) {
  const data = { version: newVersion };
  writeFileSync(VERSION_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`✓ Updated version.json`);
}

/**
 * Update frontend/package.json
 */
function updateFrontendPackageJson(newVersion) {
  const content = readFileSync(FRONTEND_PACKAGE_JSON, 'utf-8');
  const data = JSON.parse(content);
  data.version = newVersion;
  writeFileSync(FRONTEND_PACKAGE_JSON, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`✓ Updated frontend/package.json`);
}

/**
 * Update app-header.tsx version badge
 */
function updateAppHeader(newVersion) {
  let content = readFileSync(APP_HEADER_FILE, 'utf-8');
  
  // Replace the version badge text (e.g., v2.0 or v2.0.1)
  const regex = /<span className="ml-3 inline-flex items-center rounded-full border border-emerald-500 text-emerald-700 text-xs font-medium px-2 py-0\.2 bg-transparent">v[\d.]+<\/span>/;
  const replacement = `<span className="ml-3 inline-flex items-center rounded-full border border-emerald-500 text-emerald-700 text-xs font-medium px-2 py-0.2 bg-transparent">v${newVersion}</span>`;
  
  if (!regex.test(content)) {
    throw new Error('Could not find version badge in app-header.tsx');
  }
  
  content = content.replace(regex, replacement);
  writeFileSync(APP_HEADER_FILE, content, 'utf-8');
  console.log(`✓ Updated frontend/components/header/app-header.tsx`);
}

/**
 * Update settings-context.tsx CURRENT_VERSION constant
 */
function updateSettingsContext(newVersion) {
  let content = readFileSync(SETTINGS_CONTEXT_FILE, 'utf-8');

  // Replace CURRENT_VERSION constant
  const regex = /const CURRENT_VERSION = ["'][\d.]+["'];/;
  const replacement = `const CURRENT_VERSION = "${newVersion}";`;

  if (!regex.test(content)) {
    throw new Error('Could not find CURRENT_VERSION in settings-context.tsx');
  }

  content = content.replace(regex, replacement);
  writeFileSync(SETTINGS_CONTEXT_FILE, content, 'utf-8');
  console.log(`✓ Updated frontend/lib/settings-context.tsx`);
}

/**
 * Update backend/src/routes/version.js CURRENT_VERSION constant
 */
function updateBackendVersion(newVersion) {
  let content = readFileSync(BACKEND_VERSION_FILE, 'utf-8');

  // Replace CURRENT_VERSION constant
  const regex = /const CURRENT_VERSION = process\.env\.REGOLAB_VERSION \|\| ["'][\d.]+["'];/;
  const replacement = `const CURRENT_VERSION = process.env.REGOLAB_VERSION || "${newVersion}";`;

  if (!regex.test(content)) {
    throw new Error('Could not find CURRENT_VERSION in backend version.js');
  }

  content = content.replace(regex, replacement);
  writeFileSync(BACKEND_VERSION_FILE, content, 'utf-8');
  console.log(`✓ Updated backend/src/routes/version.js`);
}

/**
 * Update all files with new version
 */
function updateAllFiles(newVersion) {
  console.log(`\nUpdating version to ${newVersion}...\n`);

  try {
    updateVersionFile(newVersion);
    updateFrontendPackageJson(newVersion);
    updateAppHeader(newVersion);
    updateSettingsContext(newVersion);
    updateBackendVersion(newVersion);

    console.log(`\n✅ Successfully updated version to ${newVersion}\n`);
  } catch (error) {
    console.error(`\n❌ Error updating files: ${error.message}\n`);
    process.exit(1);
  }
}

/**
 * Main CLI handler
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'current') {
    // Show current version
    try {
      const currentVersion = getCurrentVersion();
      console.log(`Current version: ${currentVersion}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  if (args[0] === 'bump') {
    if (args.length < 2) {
      console.error('Error: Bump type required (major, minor, or patch)');
      console.error('Usage: node scripts/version.js bump <major|minor|patch>');
      process.exit(1);
    }

    const bumpType = args[1].toLowerCase();

    if (!['major', 'minor', 'patch'].includes(bumpType)) {
      console.error(`Error: Invalid bump type '${bumpType}'`);
      console.error('Must be one of: major, minor, patch');
      process.exit(1);
    }

    try {
      const currentVersion = getCurrentVersion();
      const newVersion = bumpVersion(currentVersion, bumpType);

      console.log(`Current version: ${currentVersion}`);
      console.log(`New version:     ${newVersion}`);

      updateAllFiles(newVersion);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  // Unknown command
  console.error(`Error: Unknown command '${args[0]}'`);
  console.error('\nUsage:');
  console.error('  node scripts/version.js current');
  console.error('  node scripts/version.js bump <major|minor|patch>');
  console.error('\nExamples:');
  console.error('  node scripts/version.js bump patch   # 2.0.1 → 2.0.2');
  console.error('  node scripts/version.js bump minor   # 2.0.1 → 2.1.0');
  console.error('  node scripts/version.js bump major   # 2.0.1 → 3.0.0');
  process.exit(1);
}

// Run the script
main();


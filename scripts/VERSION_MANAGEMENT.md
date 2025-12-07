# Version Management

This document describes the semantic versioning system for RegoLab.

## Current Version

The current application version is stored in `version.json` at the root of the repository.

## Version Management Script

The `scripts/version.js` script provides automated version management across all files in the codebase.

### Files Synchronized

When you bump the version, the script automatically updates:

1. **`version.json`** - Central version storage
2. **`frontend/package.json`** - Frontend package version
3. **`frontend/components/header/app-header.tsx`** - Version badge in the UI
4. **`frontend/lib/settings-context.tsx`** - CURRENT_VERSION constant
5. **`backend/src/routes/version.js`** - Backend API version constant
6. **`package.json`** - Root package version

## Usage

### Using the `v` command (recommended)

```bash
# Show current version
./v current

# Bump patch version (2.0.1 → 2.0.2)
./v bump patch

# Bump minor version (2.0.1 → 2.1.0)
./v bump minor

# Bump major version (2.0.1 → 3.0.0)
./v bump major
```

On Windows, use `v.cmd` instead:

```cmd
v current
v bump patch
```

### Using npm scripts

```bash
# Show current version
npm run version:current

# Bump patch version
npm run version:patch

# Bump minor version
npm run version:minor

# Bump major version
npm run version:major

# Custom command
npm run version bump patch
```

### Using Node directly

```bash
node scripts/version.js current
node scripts/version.js bump patch
node scripts/version.js bump minor
node scripts/version.js bump major
```

## Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** version (X.0.0): Incompatible API changes
- **MINOR** version (0.X.0): New functionality in a backward-compatible manner
- **PATCH** version (0.0.X): Backward-compatible bug fixes

### When to Bump

- **Patch**: Bug fixes, minor improvements, documentation updates
- **Minor**: New features, non-breaking changes, new functionality
- **Major**: Breaking changes, major refactors, API changes

## Examples

```bash
# Current version: 2.0.1

# Fix a bug
./v bump patch
# New version: 2.0.2

# Add a new feature
./v bump minor
# New version: 2.1.0

# Make breaking changes
./v bump major
# New version: 3.0.0
```

## Integration with CI/CD

The version script can be integrated into your CI/CD pipeline:

```bash
# In your release workflow
npm run version:patch
git add .
git commit -m "chore: bump version to $(node -p "require('./version.json').version")"
git tag "v$(node -p "require('./version.json').version")"
git push --follow-tags
```

## Troubleshooting

### Script fails to find files

Make sure you're running the script from the repository root:

```bash
cd /path/to/regolab
./v bump patch
```

### Version not updating in UI

After bumping the version, you may need to:

1. Restart the development server
2. Clear your browser cache
3. Hard reload the page (Ctrl+Shift+R or Cmd+Shift+R)

### Permission denied on Unix/Linux/Mac

Make the script executable:

```bash
chmod +x v
chmod +x scripts/version.js
```

## Manual Version Updates

If you need to manually set a specific version:

1. Edit `version.json` to set the desired version
2. Run the script to synchronize all files:
   ```bash
   node scripts/version.js bump patch  # This will read from version.json
   ```

Or manually edit all the files listed in the "Files Synchronized" section above.


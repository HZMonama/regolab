// OPAVM Documentation Content
export const OPAVM_DOCUMENTATION = `# OPA Version Management with opavm

regolab.sh now supports [opavm](https://github.com/HZMonama/opavm) - a dead-simple version manager for Open Policy Agent (OPA) and Regal.

## What is opavm?

opavm lets you install, pin, and switch OPA and Regal versions locally and per-project so your policies run against the same versions in dev, CI, and production.

## Installation

\`\`\`bash
# Install opavm
pip install opavm

# Install OPA via opavm (use a specific version number)
opavm install 1.2.0

# Set it as the global default
opavm use 1.2.0

# Install Regal (optional, for linting)
opavm install regal 0.38.0
opavm use 0.38.0 --tool regal
\`\`\`

## Usage with regolab.sh

### Global Default

Set a global default OPA version (must use a specific version number):

\`\`\`bash
opavm use 1.2.0
\`\`\`

regolab.sh will automatically detect and use this version.

### Per-Project Pinning

Pin a specific OPA version for your project:

\`\`\`bash
# In your project directory
opavm pin 1.2.0
\`\`\`

This creates a \`.opa-version\` file in your project root. regolab.sh will automatically detect this file and use the pinned version when working with policies in that project.

You can also pin Regal versions:

\`\`\`bash
# Pin Regal version
opavm pin 0.38.0 --tool regal
\`\`\`

This creates a \`.regal-version\` file for the Regal linter.

### Version Resolution Priority

regolab.sh resolves OPA versions in the following order:

1. **opavm with \`.opa-version\` file** - If a \`.opa-version\` file exists in the current or parent directories, regolab.sh uses \`opavm exec\` to run the pinned version
2. **opavm global default** - Uses the global default set via \`opavm use\`
3. **Environment variable** - Uses \`OPA_PATH\` if set
4. **System locations** - Checks standard installation locations
5. **PATH lookup** - Falls back to \`opa\` in PATH

## API Endpoints

### GET /opa/status

Returns the current OPA status:

\`\`\`json
{
  "success": true,
  "available": true,
  "version": "1.2.0",
  "path": "/home/user/.opavm/versions/1.2.0/opa",
  "source": "pinned via .opa-version"
}
\`\`\`

### GET /opa/opavm-status

Returns detailed opavm and OPA status:

\`\`\`json
{
  "success": true,
  "opa": {
    "available": true,
    "version": "1.2.0",
    "path": "/home/user/.opavm/versions/1.2.0/opa",
    "source": "global default (via opavm)"
  },
  "opavm": {
    "available": true,
    "which": "/home/user/.opavm/versions/1.2.0/opa",
    "current": "OPA 1.2.0 (global default)"
  }
}
\`\`\`

### GET /regal/status

Returns the current Regal linter status:

\`\`\`json
{
  "success": true,
  "available": true,
  "version": "0.38.0",
  "path": "/home/user/.opavm/tools/regal/versions/0.38.0/regal",
  "source": "pinned via .regal-version"
}
\`\`\`

### GET /regal/opavm-status

Returns detailed opavm and Regal status:

\`\`\`json
{
  "success": true,
  "regal": {
    "available": true,
    "version": "0.38.0",
    "path": "/home/user/.opavm/tools/regal/versions/0.38.0/regal",
    "source": "global default (via opavm)"
  },
  "opavm": {
    "available": true,
    "which": "/home/user/.opavm/tools/regal/versions/0.38.0/regal",
    "current": "Regal 0.38.0 (global default)"
  }
}
\`\`\`

## Common opavm Commands

### OPA Commands

\`\`\`bash
# Install OPA versions (must use specific version)
opavm install 1.2.0

# List installed versions
opavm list

# Set global default (must use specific version)
opavm use 1.2.0

# Pin version for current project
opavm pin 1.2.0

# Check current version
opavm current

# Get binary path
opavm which

# Run OPA with resolved version
opavm exec -- version
opavm exec -- eval -i input.json -d policy.rego "data.example.allow"

# Uninstall a version
opavm uninstall 1.2.0

# Show recent releases
opavm releases --limit 10
\`\`\`

### Regal Commands

\`\`\`bash
# Install Regal versions (must use specific version)
opavm install regal 0.38.0

# List installed Regal versions
opavm list --tool regal

# Set global default (must use specific version)
opavm use 0.38.0 --tool regal

# Pin version for current project
opavm pin 0.38.0 --tool regal

# Check current version
opavm current --tool regal

# Get binary path
opavm which --tool regal

# Run Regal with resolved version
opavm exec --tool regal -- version
opavm exec --tool regal -- lint policy/

# Uninstall a version
opavm uninstall 0.38.0 --tool regal

# Show recent releases
opavm releases --tool regal --limit 10
\`\`\`

## Docker Support

When running regolab.sh via Docker, opavm is already pre-installed and configured with OPA v1.2.0 and Regal v0.38.0. No additional setup is required.

If you need to use a different OPA version in Docker, you can:

1. Create a \`.opa-version\` file in your project with the desired version
2. Or set the \`OPA_PATH\` environment variable to override opavm

## Troubleshooting

### OPA not found

If you see "OPA executable not found":

1. Install opavm: \`pip install opavm\`
2. Install OPA with a specific version: \`opavm install 1.2.0\`
3. Set a global default: \`opavm use 1.2.0\`
4. Ensure opavm is in your PATH

### Regal not found

If you see "Regal executable not found":

1. Install Regal via opavm: \`opavm install regal 0.38.0\`
2. Set a global default: \`opavm use 0.38.0 --tool regal\`

### Wrong OPA/Regal version

Check which version is being used:

\`\`\`bash
# Check OPA
curl http://localhost:4000/opa/opavm-status

# Check Regal
curl http://localhost:4000/regal/opavm-status
\`\`\`

This will show you the resolution source (pinned file, global default, etc.)

### .opa-version not detected

The \`.opa-version\` file is searched from the current working directory up to the root. Make sure the file exists and contains a valid version number:

\`\`\`bash
echo "1.2.0" > .opa-version
\`\`\`

Same applies to \`.regal-version\` for Regal.
`;

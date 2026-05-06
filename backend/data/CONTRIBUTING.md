# Contributing to RegoLab Data

Thank you for your interest in contributing to RegoLab! This guide will help you add templates, data sources, input templates, and policies to the project.

## Table of Contents

- [Overview](#overview)
- [Contributing Templates](#contributing-templates)
- [Contributing Data Sources](#contributing-data-sources)
- [Contributing Input Templates](#contributing-input-templates)
- [Contributing Policies](#contributing-policies)
- [Submitting Your Contribution](#submitting-your-contribution)

## Overview

The `backend/data/` folder contains reusable components that power RegoLab's template library:

| Folder | Purpose |
|--------|---------|
| `templates/` | Complete policy examples with metadata, Rego code, tests, and sample data |
| `data-sources/` | JSON templates for common external data structures |
| `input-templates/` | JSON templates for common input payloads |
| `policies/` | Standalone reusable policy modules |
| `input-templates/` | Shared input structure templates |

## Contributing Templates

Templates are complete, runnable policy examples organized by category.

### Template Structure

Each template lives in its own folder under `templates/<category>/<template-name>/`:

```
templates/
├── access-control/
│   └── rbac-basic/
│       ├── meta.json      # Template metadata
│       ├── policy.rego    # Main Rego policy
│       ├── test.rego      # Unit tests
│       ├── input.json     # Sample input
│       └── data.json      # Sample external data
```

### Template Files

#### 1. `meta.json`

Required metadata for the template:

```json
{
  "title": "Template Name",
  "description": "Brief description of what this template demonstrates",
  "category": "Category Name"
}
```

**Categories:** Choose from existing categories or propose a new one:
- `Access Control` - RBAC, ABAC, permission models
- `API Authorization` - API gateway, endpoint security
- `Cloud IaC` - Terraform, CloudFormation, infrastructure policies
- `Contextual` - Time-based, location-based, contextual access
- `Data Privacy` - GDPR, data masking, privacy controls
- `Kubernetes` - Admission control, pod security, resource policies

#### 2. `policy.rego`

The main Rego policy file. Best practices:

- Start with a descriptive comment block explaining the policy
- Use clear package names (e.g., `package app.rbac`, `package kubernetes.admission`)
- Include `default` rules for all decisions
- Add inline comments for complex logic
- Follow [Rego Style Guide](https://www.openpolicyagent.org/docs/latest/policy-style/)

Example:

```rego
# My Policy
# ---------
# 
# Brief description of what this policy does and when to use it.

package my.policy

# By default, deny requests
default allow := false

# Allow if specific conditions are met
allow if {
    input.user == "admin"
    input.action == "read"
}
```

#### 3. `test.rego`

Unit tests using OPA's test framework:

```rego
package my.policy

test_allow_admin_read if {
    allow with input as {"user": "admin", "action": "read"}
}

test_deny_unknown_user if {
    not allow with input as {"user": "unknown", "action": "read"}
}
```

#### 4. `input.json`

Sample input data that demonstrates realistic usage:

```json
{
    "user": "admin",
    "action": "read",
    "resource": "document-123"
}
```

#### 5. `data.json`

Sample external data referenced by the policy:

```json
{
    "users": {
        "admin": {
            "roles": ["admin", "user"]
        }
    },
    "roles": {
        "admin": {
            "permissions": ["read", "write", "delete"]
        }
    }
}
```

## Contributing Data Sources

Data sources are reusable JSON templates for external data commonly referenced by policies.

### Data Source Structure

Add files to `data-sources/` with this format:

```json
{
  "id": "unique-identifier",
  "name": "Human Readable Name",
  "description": "What this data source represents",
  "category": "Category",
  "template": {
    // The actual JSON structure
  }
}
```

### Example Data Source

```json
{
  "id": "aws-iam-policy",
  "name": "AWS IAM Policy",
  "description": "AWS IAM policy document with statements, actions, and resources",
  "category": "Cloud",
  "template": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["s3:GetObject"],
        "Resource": "arn:aws:s3:::my-bucket/*"
      }
    ]
  }
}
```

### Categories for Data Sources

- `Cloud` - AWS, Azure, GCP resources
- `Identity` - User, role, permission data
- `HTTP` - Request/response structures
- `Kubernetes` - K8s resources and configurations
- `Security` - Tokens, certificates, audit logs
- `Infrastructure` - Terraform, CloudFormation

## Contributing Input Templates

Input templates are reusable JSON structures for policy input.

### Input Template Structure

Add files to `input-templates/` with this format:

```json
{
  "id": "unique-identifier",
  "name": "Human Readable Name",
  "description": "What this input represents",
  "category": "Category",
  "template": {
    // The actual JSON input structure
  }
}
```

### Example Input Template

```json
{
  "id": "api-request",
  "name": "API Request",
  "description": "Standard API request with user, action, and resource",
  "category": "API",
  "template": {
    "user": "user@example.com",
    "action": "read",
    "resource": "/api/v1/documents/123",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

## Contributing Policies

Standalone policy modules that can be imported and reused.

### Policy Module Structure

Add to `policies/` following the same structure as templates:

```
policies/
├── my-module/
│   ├── meta.json
│   ├── policy.rego
│   └── test.rego
```

Policy modules should be:
- **Focused** - Solve one specific problem well
- **Documented** - Clear comments explaining usage
- **Tested** - Comprehensive test coverage
- **Reusable** - Generic enough to be imported into other policies

### Example Policy Module

```rego
# Utility: Time-based Access
# --------------------------
#
# Helper functions for time-based access control decisions.
# Import with: import data.policies.time_based

package policies.time_based

import rego.v1

# Check if current time is within business hours (9 AM - 5 PM)
is_business_hours if {
    [hour, _, _] := time.clock(time.now_ns())
    hour >= 9
    hour < 17
}

# Check if today is a weekday
is_weekday if {
    weekday := time.weekday(time.now_ns())
    not weekday in ["Saturday", "Sunday"]
}
```

## Submitting Your Contribution

### Before Submitting

1. **Test your changes**:
   ```bash
   # Run OPA tests
   opa test backend/data/templates/<your-template>/
   
   # Validate Rego syntax
   opa check backend/data/templates/<your-template>/policy.rego
   ```

2. **Lint your Rego**:
   ```bash
   # If you have Regal installed
   regal lint backend/data/templates/<your-template>/policy.rego
   ```

3. **Verify JSON validity** - Ensure all `.json` files are valid

### Submitting via Pull Request

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b add-template-<name>
   ```
3. Add your template/data source/policy following the guidelines above
4. Commit with a descriptive message:
   ```bash
   git commit -m "Add template: Basic ABAC for healthcare records"
   ```
5. Push and create a pull request

### PR Description Template

```markdown
## Contribution Type
- [ ] New Template
- [ ] Data Source
- [ ] Input Template
- [ ] Policy Module
- [ ] Update to existing

## Description
Brief description of what you're adding

## Category
Which category does this belong to?

## Checklist
- [ ] Files follow naming conventions
- [ ] JSON files are valid
- [ ] Rego files pass `opa check`
- [ ] Tests pass (`opa test`)
- [ ] Documentation/comments are clear
- [ ] Follows Rego style guidelines
```

## Questions?

- Open an issue for discussion before large contributions
- Join our community discussions
- Check existing templates for examples

Thank you for making RegoLab better! 🎉

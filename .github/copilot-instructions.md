# GitHub Copilot Instructions for homebridge-rainbird

## Branch Strategy and PR Targeting

### Required PR Target Branches
All pull requests **MUST** be directed to a branch that starts with `beta-` first, never directly to the `latest` branch.

### Beta Branch Creation
If no appropriate beta branch exists, create one using the following naming convention based on the type of change:

- **Patch (Bug fixes)**: `beta-3.0.x` (e.g., `beta-3.0.4` for the next patch)
- **Minor (New features)**: `beta-3.x.0` (e.g., `beta-3.1.0` for the next minor version)  
- **Major (Breaking changes)**: `beta-x.0.0` (e.g., `beta-4.0.0` for the next major version)

The beta branch should be created from the `latest` branch and target the next logical version number.

### Required Labels for Issue Assignment
Before assigning any issue to Copilot, the following labels **MUST** be set to determine the semantic version type:

- `patch` - For bug fixes, documentation updates, and non-breaking changes
- `minor` - For new features, enhancements, and backwards-compatible changes  
- `major` - For breaking changes that require a major version bump

### Workflow Process
1. **Issue Creation**: User creates issue with appropriate description
2. **Label Assignment**: Maintainer adds one of the required labels (`patch`, `minor`, `major`)
3. **Beta Branch Check**: Verify if appropriate beta branch exists for the label type
4. **Beta Branch Creation**: If no beta branch exists, create one using the naming convention above
5. **Copilot Assignment**: Only then assign the issue to `@copilot`
6. **PR Creation**: Copilot creates PR targeting the appropriate beta branch
7. **Review and Merge**: PR is reviewed and merged to beta branch
8. **Release**: Beta branch is eventually merged to `latest` during release cycle

### Version Number Guidelines
- Current version: `3.0.3`
- Next patch: `3.0.4-beta` → `3.0.4`
- Next minor: `3.1.0-beta` → `3.1.0`
- Next major: `4.0.0-beta` → `4.0.0`

### Important Notes
- **Never target `latest` directly**: All changes must go through beta branches first
- **Label requirement**: Issues without proper labels (`patch`/`minor`/`major`) should not be assigned to Copilot
- **Beta testing**: Beta branches allow for testing before final release to `latest`
- **Semantic versioning**: Follow [semantic versioning](https://semver.org/) principles strictly

### Examples
- Bug fix for controller connectivity → Label: `patch` → Target: `beta-3.0.4`
- New zone configuration feature → Label: `minor` → Target: `beta-3.1.0`
- Breaking API changes → Label: `major` → Target: `beta-4.0.0`
# Beta Branch Management for homebridge-rainbird

## Overview
This repository uses a beta-first workflow where all changes must go through beta branches before being merged to the `latest` branch.

## Creating Beta Branches

### For Maintainers
When assigning issues to Copilot, first ensure a beta branch exists for the type of change:

#### 1. Check Current Version
Current version is in `package.json`: **3.0.3**

#### 2. Create Beta Branch Based on Label

**For `patch` label (bug fixes):**
```bash
git checkout latest
git pull origin latest
git checkout -b beta-3.0.4
git push -u origin beta-3.0.4
```

**For `minor` label (new features):**
```bash
git checkout latest  
git pull origin latest
git checkout -b beta-3.1.0
git push -u origin beta-3.1.0
```

**For `major` label (breaking changes):**
```bash
git checkout latest
git pull origin latest  
git checkout -b beta-4.0.0
git push -u origin beta-4.0.0
```

#### 3. Update Package Version in Beta Branch
After creating the beta branch, update the version in `package.json`:

**For patch beta:**
```json
"version": "3.0.4-beta.1"
```

**For minor beta:**
```json
"version": "3.1.0-beta.1"
```

**For major beta:**
```json
"version": "4.0.0-beta.1"
```

## Workflow Process

1. **Issue Created** → User creates issue
2. **Label Added** → Maintainer adds `patch`, `minor`, or `major` label
3. **Beta Branch Check** → Maintainer verifies appropriate beta branch exists
4. **Beta Branch Creation** → If needed, maintainer creates beta branch using commands above
5. **Copilot Assignment** → Maintainer assigns issue to `@copilot`
6. **PR Creation** → Copilot creates PR targeting the beta branch
7. **Testing** → Beta releases allow for testing before final release
8. **Final Release** → Beta branch merged to `latest` during release cycle

## Automated Workflows

The existing workflows handle:
- **Beta Release** (`.github/workflows/beta-release.yml`) - Triggered by pushes to `beta-*` branches
- **Final Release** (`.github/workflows/release.yml`) - Triggered by pushes to `latest`
- **Labeling** (`.github/workflows/labeler.yml`) - Automatically adds labels based on target branch

## Important Notes

- ⚠️ **Never assign issues to Copilot without proper labels**
- ⚠️ **Ensure beta branch exists before assignment**  
- ✅ **All PRs must target beta branches first**
- ✅ **Beta branches allow testing before final release**
- ✅ **Semantic versioning is strictly enforced**
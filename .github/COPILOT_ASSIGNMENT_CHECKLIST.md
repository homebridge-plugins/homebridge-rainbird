# Quick Reference: Copilot Assignment Checklist

## Before Assigning Issues to @copilot:

### ✅ Required Steps:

1. **Add Semantic Version Label**:
   - `patch` - Bug fixes, docs, non-breaking changes
   - `minor` - New features, backwards-compatible changes  
   - `major` - Breaking changes

2. **Verify Beta Branch Exists**:
   - `patch` → Check for `beta-3.0.4` (or next patch)
   - `minor` → Check for `beta-3.1.0` (or next minor)
   - `major` → Check for `beta-4.0.0` (or next major)

3. **Create Beta Branch if Missing**:
   ```bash
   git checkout latest && git pull
   git checkout -b beta-X.Y.Z
   git push -u origin beta-X.Y.Z
   ```

4. **Assign to Copilot**:
   - Only after label is set and beta branch exists

### ❌ Don't Assign If:
- No semantic version label (`patch`/`minor`/`major`)
- Corresponding beta branch doesn't exist
- Issue is unclear or needs more discussion

### 🔄 Current Version: 3.0.3
- Next patch: `beta-3.0.4`  
- Next minor: `beta-3.1.0`
- Next major: `beta-4.0.0`
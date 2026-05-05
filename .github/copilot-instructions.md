# GitHub Copilot Instructions for homebridge-rainbird

## Branch Strategy and PR Targeting

### Required PR Target Branches
All pull requests MUST be directed to a branch that starts with `beta-` first, never directly to the `latest` branch.

### Beta Branch Creation
If no appropriate beta branch exists, create one using the following naming convention based on the type of change:

- Patch (bug fixes): `beta-3.1.x` (example: `beta-3.1.2`)
- Minor (new features): `beta-3.x.0` (example: `beta-3.2.0`)
- Major (breaking changes): `beta-x.0.0` (example: `beta-4.0.0`)

The beta branch should be created from the `latest` branch and target the next logical version number.

### Required Labels for Issue Assignment
Before assigning any issue to Copilot, one of these labels MUST be set:

- `patch` for bug fixes, docs, and non-breaking changes
- `minor` for new features and backwards-compatible enhancements
- `major` for breaking changes requiring a major version bump

### Workflow Process
1. Issue creation
2. Label assignment (`patch`, `minor`, or `major`)
3. Beta branch existence check
4. Beta branch creation if needed
5. Copilot assignment
6. PR creation targeting beta branch
7. Review and merge to beta branch
8. Release merge from beta branch to `latest`

### Version Number Guidelines
- Current version: `3.1.1`
- Next patch: `3.1.2-beta` -> `3.1.2`
- Next minor: `3.2.0-beta` -> `3.2.0`
- Next major: `4.0.0-beta` -> `4.0.0`

### Important Notes
- Never target `latest` directly
- Do not assign unlabeled issues to Copilot
- Use semantic versioning strictly

## Homebridge RainBird Plugin Development Guide

Homebridge RainBird is a TypeScript Homebridge plugin that integrates RainBird irrigation controllers with HomeKit and Homebridge Matter.

## Working Effectively

### Prerequisites
- Node.js: `^22 || ^24`
- npm available

### Bootstrap, Build, and Test Commands
- `npm install` - install dependencies
- `npm run build` - clean, compile TypeScript, copy plugin UI assets
- `npm run lint` - lint TypeScript source files
- `npm run lint:fix` - auto-fix lint issues
- `npm run test` - runs linter
- `npm run docs` - generate TypeDoc
- `npm run lint-docs` - type-doc validation without emitting docs
- `npm run clean` - remove `dist`
- `npm run plugin-ui` - copy UI `index.html` to `dist/homebridge-ui/public`
- `npm run watch` - build, link, and run `nodemon`
- `npx tsc --noEmit` - type-check only

### Validation Steps
- Always run `npm run lint`
- Always run `npm run build`
- Run `npx tsc --noEmit` for strict type validation
- Optional smoke check: `node -e "require('./dist/index.js'); console.log('OK')"`

### Hardware Validation Constraints
Full end-to-end behavior requires a physical RainBird controller and reachable network path. Without hardware, validate build, typing, linting, schema, and platform initialization paths.

## Code Structure

### Core Files
- `src/index.ts` - plugin entrypoint and runtime platform proxy registration
- `src/utils.ts` - HAP/Matter runtime selection (`createPlatformProxy`)
- `src/Platform.HAP.ts` - HAP platform implementation and accessory lifecycle
- `src/Platform.Matter.ts` - Matter platform implementation with HAP fallback
- `src/settings.ts` - config interfaces/constants
- `config.schema.json` - Homebridge Config UI schema

### Device Implementations (`src/devices`)
- `IrrigationSystem.ts`
- `ZoneValve.ts`
- `ContactSensor.ts`
- `LeakSensor.ts`
- `ProgramSwitch.ts`
- `StopIrrigationSwitch.ts`
- `DelayIrrigationSwitch.ts`
- `TestZoneSwitch.ts`
- `DeviceBase.ts`

### UI Files
- `src/homebridge-ui/server.ts`
- `src/homebridge-ui/public/index.html`

## Dependencies and Libraries
- `rainbird` `^1.2.9`
- `@homebridge/plugin-ui-utils` `^2.2.3`
- `rxjs` `^7.8.1`
- `homebridge` (dev dependency) `^2.0.0-beta.88`

## Configuration Notes

### Platform Options (`options`)
- `refreshRate`
- `updateRate`
- `pushRate`
- `logging`
- `allowInvalidCharacters`
- `enableMatter`
- `preferMatter`

### Per-Device Highlights (`devices[]`)
- Connectivity: `ipaddress`, `password`
- Exposure: `external`, `hide_device`
- Accessories toggles: rain sensor, valve sensor, program switches A-D, stop/delay irrigation switch, zone valves, test zone switch
- Runtime tuning: `refreshRate`, `updateRate`, `pushRate`, `logging`
- Misc: `includeZones`, `irrigationDelay`, `syncTime`, `showRequestResponse`, `firmware`

## Architecture Notes

### Platform Selection
`src/index.ts` registers a proxy constructor via `createPlatformProxy(HAPPlatform, MatterPlatform)`.

Runtime selection behavior:
- If Matter is enabled in config and available in Homebridge, instantiate `RainbirdMatterPlatform`
- Otherwise, instantiate `RainbirdPlatform` (HAP)

### HAP Mode
`RainbirdPlatform` performs:
- config verification/defaulting
- RainBird connection initialization
- capability detection (`getCommandSupport`)
- accessory creation/removal and cache handling

### Matter Mode
`RainbirdMatterPlatform`:
- extends `RainbirdPlatform`
- uses Homebridge Matter API when available
- falls back to HAP discovery when Matter is unavailable
- registers/upserts Matter accessories
- tracks Matter subscriptions to avoid duplicate handlers

## Matter Device Type Mapping (Current)

These mappings reflect `src/Platform.Matter.ts`:

| Plugin Accessory | Matter Device Type | Cluster(s) |
|---|---|---|
| Irrigation System | `WaterValve` | `valveConfigurationAndControl` |
| Zone Valve | `WaterValve` | `valveConfigurationAndControl` |
| Leak Sensor (Rain Sensor) | `LeakSensor` | `booleanState` |
| Zone Contact Sensor | `ContactSensor` | `booleanState` |
| Program Switches (A-D) | `OnOffSwitch` | `onOff` |
| Stop Irrigation Switch | `OnOffSwitch` | `onOff` |
| Delay Irrigation Switch | `OnOffSwitch` | `onOff` |
| Test Zone Switch | `OnOffSwitch` | `onOff` |

## Authoritative Matter References

Use these references first for Matter behavior and cluster/device mapping:
1. https://github.com/homebridge-plugins/homebridge-matter/wiki/Introduction
2. https://github.com/homebridge-plugins/homebridge-matter/wiki/Section-7-Sensors
3. https://github.com/homebridge-plugins/homebridge-matter/wiki/API-Reference
4. https://matter-js.github.io/docs/index.html

## Changelog Format Requirements

When generating a changelog release entry, use this structure:

1. Release header:

```md
## [X.Y.Z](https://github.com/homebridge-plugins/homebridge-rainbird/compare/vX.Y.(Z-1)...vX.Y.Z) (YYYY-MM-DD)
```

2. Standard sections as needed (`### Bug Fixes`, `### Enhancements`, `### Documentation`, etc.).

3. Full comparison URL footer:

```md
**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/vX.Y.(Z-1)...vX.Y.Z
```

Do not omit the header link or full changelog link when creating a new release entry.

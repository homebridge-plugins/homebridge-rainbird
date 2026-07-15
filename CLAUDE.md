# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` — `rimraf ./dist && tsc && npm run plugin-ui`. The `plugin-ui` step rsyncs `src/homebridge-ui/public/index.html` into `dist/` (the UI server itself is TypeScript and compiled by `tsc`). Skipping it produces a broken published package.
- `npm run lint` — ESLint over the whole repo with `--max-warnings=0`. CI fails on any warning. `npm run lint:fix` to autofix.
- There is no test suite in this repo (no vitest).
- `npm run watch` — build, `npm link`, then `nodemon`: recompiles and restarts `homebridge -U ./test/hbConfig -D` on `src/**/*.ts` changes. `./test/hbConfig` is gitignored; create it locally with a `config.json` containing the controller IP and password.
- `npm run docs` — typedoc into `docs/` (gitignored — generated output is never committed).
- `npm run prepublishOnly` — lint then build; runs automatically on publish.

CI (`.github/workflows/build.yml`) runs install + lint on Node 22.x/24.x. Releases publish via `.github/workflows/release.yml`: a GitHub release (tag `vX.Y.Z`) publishes to npm's `latest` tag; pushes to `beta-X.Y.Z` / `alpha-X.Y.Z` branches publish incrementing prerelease versions to the `beta` / `alpha` tags.

Supported Node: `^22.12.0 || ^24.0.0`. Homebridge: `^2.0.0`.

## Architecture

Homebridge dynamic platform plugin (`platform: "RainBird"`, package `@homebridge-plugins/homebridge-rainbird`) bridging RainBird irrigation controllers (with the LNK WiFi module) into HomeKit. Communication is local to the controller — no cloud.

### The rainbird library

All controller protocol work lives in the external [`rainbird`](https://github.com/donavanbecker/rainbird) package (originally by @mantorok1). The platform creates one `RainBirdService` per configured controller (IP + password) and passes it to every device class. `detectControllerCapabilities` probes what the model supports (e.g. time-remaining) and gates optional features.

### HAP/Matter platform selection

`src/index.ts` registers a runtime proxy that picks `RainBirdMatterPlatform` (`src/Platform.Matter.ts`, extends the HAP platform) when Homebridge reports Matter available+enabled (config-gated), otherwise `RainBirdPlatform` (`src/Platform.HAP.ts`). Matter API calls must stay optional-chained.

### Device classes (`src/devices/`)

All extend `DeviceBase` (`src/devices/DeviceBase.ts`). One accessory type per file: `IrrigationSystem` (the zones), `ProgramSwitch` (A/B/C programs), `ZoneValve`, `TestZoneSwitch`, `DelayIrrigationSwitch`, `StopIrrigationSwitch`, `ContactSensor`, `LeakSensor` (rain sensor). The platform registers each instance through `this.registerHandler(new X(this, accessory, device, rainbird))` — handlers are tracked centrally, so follow that pattern rather than bare `new`.

### Logging

Leveled log helpers (`infoLog`, `warnLog`, `errorLog`, `debugLog`, …) gated by `config.options.logging` with per-device overrides. The rainbird library's own logging is bridged via `LogLevel`. Use the helpers instead of `this.log` directly.

## Conventions

- TypeScript ESM (`"type": "module"`): relative imports use `.js` extensions even from `.ts` source.
- ESLint is `@antfu/eslint-config` (flat config in `eslint.config.js`): single quotes, 1tbs braces, `curly` multi-line only, sorted exports. Run `npm run lint:fix` before committing.
- `config.schema.json` defines the Homebridge UI form and must stay in sync with the interfaces in `src/settings.ts`.
- Copyright headers in `src/` credit @donavanbecker, the original plugin author — leave them in place.

# Copilot instructions

Guidance for AI coding agents working in this repository. The fuller version of this document is [CLAUDE.md](../CLAUDE.md) at the repo root — keep the two in sync.

## Commands

- Build: `npm run build` (`rimraf ./dist` → `tsc` → copy plugin UI html). All steps are required for a working package.
- Lint: `npm run lint` (`eslint . --max-warnings=0`, CI fails on warnings); `npm run lint:fix` to autofix.
- No test suite in this repo.
- Local dev loop: `npm run watch` (rebuild + restart `homebridge -U ./test/hbConfig -D` on changes; `./test/hbConfig` is gitignored, create locally).

## Key architecture facts

- Homebridge dynamic platform plugin bridging RainBird irrigation controllers (LNK WiFi module) into HomeKit; communication is local, no cloud.
- Controller protocol lives in the external `rainbird` package: one `RainBirdService` per controller, passed to every device class; `detectControllerCapabilities` gates optional features per model.
- `src/index.ts` registers a runtime HAP/Matter proxy; keep `api.matter?.…` calls optional-chained.
- Device classes in `src/devices/` extend `DeviceBase`; the platform registers instances via `this.registerHandler(new X(this, accessory, device, rainbird))` — follow that pattern.
- Use the platform's leveled log helpers (`infoLog`, `debugLog`, …) so user logging settings are respected.

## Conventions

- TypeScript ESM: relative imports need `.js` extensions.
- ESLint `@antfu/eslint-config`: single quotes, sorted exports; run `npm run lint:fix` before committing.
- `config.schema.json` must stay in sync with the config interfaces in `src/settings.ts`.
- Copyright headers in `src/` credit @donavanbecker (original author) — leave them in place.

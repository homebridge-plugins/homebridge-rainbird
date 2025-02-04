# Changelog

All notable changes to this project will be documented in this file. This project uses [Semantic Versioning](https://semver.org/)

## [3.0.1](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v3.0.1) (2025-01-25)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v3.0.0...v3.0.1

## [3.0.0](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v3.0.0) (2025-01-16)

### What's Changed
- This plugins has moved to a scoped plugin under the `@homebridge-plugins` org.
  - Homebridge UI is designed to transition you to the new scoped plugin.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v2.2.1...v3.0.0

## [2.2.1](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v2.2.1) (2024-11-04)

### What's Changed
- Fix refreshRate Issue

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v2.2.0...v2.2.1

## [2.2.0](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v2.2.0) (2024-11-03)

### What's Changed
- Receive new emitted logs from `rainbird` library
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v2.1.2...v2.2.0

## [2.1.2](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v2.1.2) (2024-09-25)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v2.1.1...v2.1.2

## [2.1.1](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v2.1.1) (2024-09-13)

### What's Changed
- Fixed an issue with password field not displaying in UI.
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v2.1.0...v2.1.1

## [2.1.0](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v2.1.0) (2024-08-31)

### What's Changed
- Update `rainbird` modeule to `v1.1.0`
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v2.0.3...v2.1.0

## [2.0.3](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v2.0.3) (2024-05-26)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v2.0.2...v2.0.3

## [2.0.2](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v2.0.2) (2024-02-13)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v2.0.1...v2.0.2

## [2.0.1](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v2.0.1) (2024-02-13)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v2.0.0...v2.0.1

## [2.0.0](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.11.3) (2024-01-31)

### What's Changed
- Moved rainbird module components into a seperate repo: https://github.com/donavanbecker/rainbird
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.11.3...v2.0.0

## [1.11.3](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.11.3) (2023-12-15)

### What's Changed
- Fixed Programs are not aligned between Homebridge and the Rainbird, [#502](https://github.com/homebridge-plugins/homebridge-rainbird/issues/502)
- Fix Program ID for ME3
- Fix issue with determining available zones, [#510](https://github.com/homebridge-plugins/homebridge-rainbird/issues/510)
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.11.2...v1.11.3

## [1.11.2](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.11.2) (2023-11-26)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.11.1...v1.11.2

## [1.11.1](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.11.0) (2023-08-27)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.11.0...v1.11.1

## [1.11.0](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.11.0) (2023-08-19)

### What's Changed
- Added `minValueRemainingDuration` and `maxValueRemainingDuration` for Remaining Duration Characteristic. [#485](https://github.com/homebridge-plugins/homebridge-rainbird/issues/485)
- Added time remaining to Zone Running log messages. [#486](https://github.com/homebridge-plugins/homebridge-rainbird/issues/486)
- Added `includeZones` to allow only specified zones to be created as Valve accessories. [#488](https://github.com/homebridge-plugins/homebridge-rainbird/issues/488)
- Added showing Idle/Waiting state for zones queued by scheduled programs (only for ESP-TM2 & ESP-ME3 at this stage)
- Added support warning for other models about limited zone state details
- Added Delay Irrigation Switch [#489](https://github.com/homebridge-plugins/homebridge-rainbird/issues/489)
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.10.0...v1.11.0

## [1.10.0](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.10.0) (2023-04-07)

### What's Changed
- Added Program state & Zone Time Remaining for ESP-ME3. [#395](https://github.com/homebridge-plugins/homebridge-rainbird/issues/395) [#396](https://github.com/homebridge-plugins/homebridge-rainbird/issues/396) [Thanks [dacarson](https://github.com/dacarson) for your help]
- Added option to sync the Rainbird controllers date & time with the Homebridge host.
- Housekeeping and updated dependencies.
  - This release will end support for Node v14.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.9.0...v1.10.0

## [1.9.0](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.9.0) (2022-12-08)

### What's Changed
- Fixed Issue where RainBird controller request failed. [#390](https://github.com/homebridge-plugins/homebridge-rainbird/issues/390)
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.8.1...v1.9.0

## [1.8.1](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.8.1) (2022-10-19)

### What's Changed
- Fixed Issue where RainBird controller request failed. [#390](https://github.com/homebridge-plugins/homebridge-rainbird/issues/390)
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.8.0...v1.8.1

## [1.8.0](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.8.0) (2022-10-18)

### What's Changed
- Added Config to allow manually setting firmware version.
- Housekeeping and updated dependencies.


**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.7.3...v1.8.0

## [1.7.3](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.7.3) (2022-08-31)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.7.2...v1.7.3

## [1.7.2](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.7.2) (2022-06-25)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.7.1...v1.7.2

## [1.7.1](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.7.1) (2022-05-04)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.7.0...v1.7.1

## [1.7.0](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.7.0) (2022-03-31)

### What's Changed
- Added option to show zones as separate valve accessories.
- Refactored device classes to use a common base class.
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.6.4...v1.7.0

## [1.6.4](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.6.4) (2022-03-19)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.6.3...v1.6.4

## [1.6.3](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.6.3) (2022-02-15)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.6.2...v1.6.3

## [1.6.2](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.6.2) (2022-02-12)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.6.1...v1.6.2

## [1.6.1](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.6.1) (2022-01-29)

### What's Changed
- Restore Request/Response logging.
- prevent Program Switch showing as running when rain set point reached.
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.6.0...v1.6.1

## [1.6.0](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.6.0) (2022-01-27)

### What's Changed

### Major Change To `Logging`:
- Added the following Logging Options:
  - `Standard`
  - `None`
  - `Debug`
- Removed Device Logging Option, which was pushed into new logging under debug.
- Added Device Logging Override for each Device, by using the Device Config.

### Major Changes to `refreshRate`:
- Added an option to override `refreshRate` for each Device, by using the Device Config.

### Other Changes
- Added option to show Program Switches for Program A, B, & C.
- Added option to enable a switch to Stop Irrigation Switch.
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.5.2...v1.6.0

## [1.5.2](https://github.com/homebridge-plugins/homebridge-rainbird/releases/tag/v1.5.2) (2021-12-15)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.5.1...v1.5.2

## [1.5.1](https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.5.0...v1.5.1) (2021-11-12)

### What's Changed
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.5.0...v1.5.1

## [1.5.0](https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.4.0...v1.5.0) (2021-11-06)

### What's Changed
- Added enableZone to find Enabled Zones
- Added Command Logging for plugin
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.4.0...v1.5.0

## [1.4.0](https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.3.0...v1.4.0) (2021-10-28)

### What's Changed
- Added support to show vavles as contact sensors
  - Allows you to get notified in the Home App when a Zone has started.
- Added Device Logging and Debug Logging for plugin
- Changed from `node-fetch` to `axios`
- Housekeeping and updated dependencies.
- Persist configured and duration values
- Fixed issue where some models were not able to stop a zone

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.3.0...v1.4.0

## [1.3.0](https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.2.0...v1.3.0) (2021-10-09)

### What's Changed
- Support for rain sensor using the HomeKit leak sensor
- Suppress a zone's active status when scheduled program has been suspended (due to rain)
- Use "Advance Zone" command instead of "Stop Irrigation" so remaining zones can still run for a scheduled program
- Fixed `RainBird controller request failed RangeError [ERR_OUT_OF_RANGE]` for ESP-ME3 [#57](https://github.com/homebridge-plugins/homebridge-rainbird/issues/57)

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.2.0...v1.3.0

## [1.2.0](https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.1.0...v1.2.0) (2021-09-29)

### What's Changed
- Added CurrentZoneTimeRemainingRequest & CurrentZoneTimeRemainingResponse function.
- Fixed issue where some RainBird controllers (such as ESP-RZXe & ESP-Me) couldn't show the time remaining for a zone that was not started via the plugin (such as a scheduled program).

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.1.0...v1.2.0

## [1.1.0](https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.0.0...v1.1.0) (2021-09-27)

### What's Changed
- Add Support for More Models and Added Compatiable Models to Readme.
- Fixed `Failed to Discover Devices, "Cannot read property 'getTime' of undefined"` [#39](https://github.com/homebridge-plugins/homebridge-rainbird/issues/39).

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v1.0.0...v1.1.0

## [1.0.0](https://github.com/homebridge-plugins/homebridge-rainbird/compare/v0.1.0...v1.0.0) (2021-09-19)

### What's Changed
- Official Release of Homebridge RainBird Plugin.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-rainbird/compare/v0.1.0...v1.0.0

## [0.1.0](https://github.com/homebridge-plugins/homebridge-rainbird/tag/v0.0.1) (2021-08-29)

### What's Changed
- Initial Release

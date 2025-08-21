# Homebridge RainBird Plugin Development Guide

**Homebridge RainBird** is a TypeScript-based Homebridge plugin that enables HomeKit integration with RainBird irrigation controllers. The plugin communicates with RainBird controllers over WiFi using the ESP LNK WiFi Module protocol.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites and Setup
- Install Node.js v20 or v22 (required by package.json engines)
- Ensure npm is available (tested with npm 10.8.2)

### Bootstrap, Build, and Test Commands
- `npm install` -- Install dependencies. Takes ~30-35 seconds. NEVER CANCEL.
- `npm run build` -- Clean, compile TypeScript, and copy UI files. Takes ~4-5 seconds.
- `npm run lint` -- Run ESLint on TypeScript source files. Takes ~3 seconds.
- `npm run lint:fix` -- Auto-fix ESLint issues. Takes ~3 seconds.
- `npm run test` -- Run tests (currently just runs linter). Takes ~3 seconds.
- `npm run docs` -- Generate TypeDoc documentation. Takes ~5 seconds.
- `npm run clean` -- Remove dist directory.
- `npm run plugin-ui` -- Copy UI files to dist directory. Must run after `tsc` to ensure target directories exist.
- `npm run check` -- Install dependencies and check for outdated packages.
- `tsc` -- Compile TypeScript only (without cleaning). Takes ~2 seconds.
- `npx tsc --noEmit` -- Type check without emitting files. Takes ~2 seconds.

### Development Workflow
- `npm run watch` -- Start development mode with file watching and automatic Homebridge restart.
  - Watches src/ and config.schema.json for changes
  - Automatically compiles and restarts Homebridge
  - Requires Homebridge to be globally installed: `npm install -g homebridge`
  - Uses ~/.homebridge-dev for development configuration
  - **Note**: This will fail in environments without Homebridge installed globally

### Build Output Structure
After running `npm run build`, the `dist/` directory contains:
- Compiled JavaScript files (.js)
- TypeScript declaration files (.d.ts)
- Source maps (.js.map, .d.ts.map)
- homebridge-ui/ directory with plugin UI components

## Validation

### Required Validation Steps
- Always run `npm run lint` before committing changes or the CI will fail.
- Always run `npm run build` to ensure TypeScript compilation succeeds.
- NEVER CANCEL any build commands - they complete quickly (under 10 seconds each).
- The plugin has no actual test suite - the test script only runs the linter.
- Run `npx tsc --noEmit` for type checking without file generation.
- Test plugin loading with: `node -e "require('./dist/index.js'); console.log('OK')"`

### Manual Testing Scenarios
Since this plugin communicates with physical RainBird controllers, full testing requires:
1. A RainBird controller with ESP LNK WiFi Module
2. Controller configured with static IP address and password
3. Network connectivity between development machine and controller

**Mock Testing Approach**: Without physical hardware, validate that:
- Plugin builds without errors
- Configuration schema is valid
- TypeScript types are correct
- ESLint passes

### CI/CD Validation
The GitHub Actions workflow (.github/workflows/build.yml) runs:
- Node.js build and test (uses homebridge shared workflow)
- ESLint validation
Always ensure local `npm run lint` passes before pushing.

## Code Structure

### Key Files and Directories
- `src/platform.ts` -- Main plugin platform class implementing DynamicPlatformPlugin
- `src/index.ts` -- Plugin entry point that registers the platform
- `src/settings.ts` -- Configuration interfaces and constants
- `src/devices/` -- Device-specific implementations:
  - `IrrigationSystem.ts` -- Main irrigation system accessory
  - `ZoneValve.ts` -- Individual zone valve controls
  - `ContactSensor.ts` -- Zone status sensors
  - `LeakSensor.ts` -- Rain/leak detection sensors
  - `ProgramSwitch.ts` -- Program A/B/C/D switches
  - `StopIrrigationSwitch.ts` -- Emergency stop switch
  - `DelayIrrigationSwitch.ts` -- Irrigation delay controls
- `src/homebridge-ui/` -- Custom configuration UI components
  - `server.ts` -- Backend server for UI
  - `public/index.html` -- Frontend UI
- `config.schema.json` -- Configuration schema for Homebridge UI

### Dependencies and Libraries
- **rainbird** (v1.2.4) -- Core library for RainBird controller communication
- **@homebridge/plugin-ui-utils** -- Homebridge custom UI utilities
- **rxjs** -- Reactive programming for async operations
- **homebridge** (dev) -- Homebridge platform (dev dependency)

### Configuration Structure
The plugin uses this configuration format:
```json
{
  "platform": "RainBird",
  "name": "RainBird",
  "devices": [
    {
      "ipaddress": "192.168.1.100",
      "password": "controller-password",
      "configDeviceName": "Backyard Sprinklers"
    }
  ],
  "options": {
    "refreshRate": 300,
    "pushRate": 0.1
  }
}
```

## Common Development Tasks

### Adding New Device Types
1. Create new device class in `src/devices/` extending `DeviceBase`
2. Implement required HomeKit service and characteristic handling
3. Add device creation logic in `src/platform.ts`
4. Update configuration schema in `config.schema.json` if needed
5. Update TypeScript interfaces in `src/settings.ts`

### Modifying Configuration Options
1. Update interfaces in `src/settings.ts`
2. Update `config.schema.json` for UI validation
3. Handle new options in `verifyConfig()` method in `src/platform.ts`
4. Test configuration changes through Homebridge Config UI X

### Debugging Controller Communication
- Enable debug logging by setting appropriate log levels
- Use `showRequestResponse` device option to log API calls
- Monitor network traffic between plugin and controller
- Check RainBird controller logs if accessible

### UI Development
- Frontend: Edit `src/homebridge-ui/public/index.html`
- Backend: Modify `src/homebridge-ui/server.ts`
- Always run `npm run plugin-ui` after UI changes
- UI changes require plugin restart in Homebridge

## Project Architecture

### Plugin Flow
1. **Initialization**: Platform constructor validates config and sets up logging
2. **Device Discovery**: Platform discovers devices based on IP addresses in config
3. **Accessory Creation**: Creates HomeKit accessories for each device type
4. **Communication**: Uses RainBird library to communicate with controllers
5. **State Updates**: Polls devices based on refreshRate and updates HomeKit

### Error Handling
- Network connectivity issues with controllers
- Invalid configuration (missing IP/password)
- Controller authentication failures
- HomeKit accessory registration conflicts

### Performance Considerations
- Default refresh rate is 300 seconds (5 minutes)
- Push rate for updates is 0.1 seconds (100ms)
- Plugin supports multiple controllers simultaneously
- UI caches accessory information for better performance

## Troubleshooting

### Common Issues
- **Build fails**: Run `npm run clean && npm install && npm run build`
- **Lint errors**: Run `npm run lint:fix` to auto-fix formatting issues
- **Controller not responding**: Check network connectivity and credentials
- **HomeKit accessories not appearing**: Verify plugin configuration and restart Homebridge

### Development Environment
- Use `npm run watch` for active development with auto-reload
- Check `~/.homebridge-dev/` for development logs and configuration
- Monitor Homebridge logs for plugin-specific error messages
- Use Node.js debugging tools for deeper investigation

Remember: This plugin requires actual RainBird hardware for full functionality testing. Focus on code quality, build validation, and configuration correctness during development.
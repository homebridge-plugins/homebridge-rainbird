import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, Service, Characteristic } from 'homebridge';
import { RainBirdService } from './RainBird/RainBirdService';
import {
  PLATFORM_NAME,
  PLUGIN_NAME,
  RainbirdPlatformConfig,
  DevicesConfig,
} from './settings';
import { IrrigationSystem } from './devices/IrrigationSystem';
import { ContactSensor } from './devices/ContactSensor';
import { LeakSensor } from './devices/LeakSensor';
import { ProgramSwitch } from './devices/ProgramSwitch';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class RainbirdPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  version = require('../package.json').version; // eslint-disable-line @typescript-eslint/no-var-requires

  public sensorData = [];

  constructor(public readonly log: Logger, public readonly config: RainbirdPlatformConfig, public readonly api: API) {
    this.debug('Finished initializing platform:', this.config.name);
    // only load if configured
    if (!this.config) {
      return;
    }

    // HOOBS notice
    if (__dirname.includes('hoobs')) {
      this.log.warn('This plugin has not been tested under HOOBS, it is highly recommended that ' +
        'you switch to Homebridge: https://git.io/Jtxb0');
    }

    // verify the config
    try {
      this.verifyConfig();
      this.debug('Config OK');
    } catch (e: any) {
      this.log.error(JSON.stringify(e.message));
      this.debug(JSON.stringify(e));
      return;
    }

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');
      try {
        await this.discoverDevices();
      } catch (e: any) {
        this.log.error('Failed to Discover Devices,', JSON.stringify(e.message));
        this.debug(JSON.stringify(e));
      }
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Verify the config passed to the plugin is valid
   */
  verifyConfig() {
    this.initialiseConfig();

    if (this.config.devices) {
      for (const device of this.config.devices!) {
        if (!device.ipaddress) {
          throw new Error('The devices config section is missing the "IP Address" in the config, and will be skipped.');
        }
        if (!device.password) {
          throw new Error('The devices config section is missing the "Password" in the config, and will be skipped.');
        }
      }
    } else {
      throw new Error('The devices config section is missing from the config. This device will be skipped.');
    }

    this.config.options = this.config.options || {};

    if (this.config.disablePlugin) {
      this.log.error('Plugin is disabled.');
    }

    if (!this.config.options.refreshRate && !this.config.disablePlugin) {
      // default 300 seconds (5 minutes)
      this.config.options!.refreshRate! = 300;
      this.device('Using Default Refresh Rate.');
    }

    if (!this.config.options.pushRate && !this.config.disablePlugin) {
      // default 100 milliseconds
      this.config.options!.pushRate! = 0.1;
      this.device('Using Default Push Rate.');
    }
  }

  private initialiseConfig(): void {
    this.config.disablePlugin = this.config.disablePlugin ?? false;
    for(const device of this.config.devices ?? []) {
      device.showRainSensor = device.showRainSensor ?? false;
      device.showValveSensor = device.showValveSensor ?? false;
      device.showProgramASwitch = device.showProgramASwitch ?? false;
      device.showProgramBSwitch = device.showProgramBSwitch ?? false;
      device.showProgramCSwitch = device.showProgramCSwitch ?? false;
    }
  }

  /**
   * This method is used to discover the your location and devices.
   */
  private async discoverDevices(): Promise<void> {
    for (const device of this.config.devices!) {
      const rainbird = new RainBirdService({
        address: device.ipaddress!,
        password: device.password!,
        refreshRate: this.config.options!.refreshRate,
        log: this.log,
        logCommands: this.config.options?.debug === 'command',
      });
      const metaData = await rainbird!.init();
      this.debug(JSON.stringify(metaData));

      // Display device details
      this.log.info(`Model: ${metaData.model}, [Version: ${metaData.version}, Serial Number: ${metaData.serialNumber},`
        + ` Zones: ${JSON.stringify(metaData.zones)}]`);
      const irrigationAccessory = this.createIrrigationSystem(device, rainbird);
      this.createLeakSensor(device, rainbird);
      for(const zoneId of metaData.zones) {
        const configured = irrigationAccessory!.context.configured[zoneId] ?? this.Characteristic.IsConfigured.CONFIGURED;
        if (configured === this.Characteristic.IsConfigured.CONFIGURED) {
          this.createContactSensor(device, rainbird, zoneId);
        }
      }
      for(const programId of ['A', 'B', 'C']) {
        this.createProgramSwitch(device, rainbird, programId);
      }

      // Handle zone enable/disable
      rainbird.on('zone_enable', (zoneId, enabled) => {
        if (enabled) {
          this.createContactSensor(device, rainbird, zoneId);
        } else {
          const model = `${rainbird!.model}-${zoneId}`;
          const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`);
          const index = this.accessories.findIndex((accessory) => accessory.UUID === uuid);
          if (index >= 0) {
            this.unregisterPlatformAccessories(this.accessories[index]);
            this.accessories.splice(index, 1);
          }
        }
      });
    }
  }

  private createIrrigationSystem(device: DevicesConfig, rainbird: RainBirdService): PlatformAccessory | undefined {
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${rainbird!.model}-${rainbird!.serialNumber}`);
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);

    if (existingAccessory) {
      // the accessory already exists
      if (!this.config.disablePlugin) {
        this.log.info(`Restoring existing accessory from cache: ${existingAccessory.displayName}`);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = rainbird!.model;
        existingAccessory.context.device = device;
        existingAccessory.context.deviceID = rainbird!.serialNumber;
        existingAccessory.context.model = rainbird!.model;
        existingAccessory.context.FirmwareRevision = rainbird!.version;
        this.api.updatePlatformAccessories([existingAccessory]);
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new IrrigationSystem(this, existingAccessory, device, rainbird);
        this.device(`Irrigation System uuid: ${device.ipaddress}-${rainbird!.model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`);
        return existingAccessory;
      } else {
        this.unregisterPlatformAccessories(existingAccessory);
      }
    } else if (!this.config.disablePlugin) {
      // the accessory does not yet exist, so we need to create it
      this.log.info(`Adding new accessory: ${rainbird!.model}`);

      // create a new accessory
      const accessory = new this.api.platformAccessory(rainbird!.model, uuid);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.context.device = device;
      accessory.context.deviceID = rainbird!.serialNumber;
      accessory.context.model = rainbird!.model;
      accessory.context.FirmwareRevision = rainbird!.version;
      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      new IrrigationSystem(this, accessory, device, rainbird);
      this.device(`Irrigation System uuid: ${device.ipaddress}-${rainbird!.model}-${rainbird!.serialNumber}, (${accessory.UUID})`);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
      return accessory;
    } else {
      if (this.config.options?.debug === 'debug') {
        this.log.error(`Unable to Register new device: ${rainbird!.model}`);
      }
    }
  }

  private createLeakSensor(device: DevicesConfig, rainbird: RainBirdService): void {
    const model = 'WR2';
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`);
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);

    if (existingAccessory) {
      // the accessory already exists
      if (!this.config.disablePlugin && device.showRainSensor) {
        this.log.info(`Restoring existing accessory from cache: ${existingAccessory.displayName}`);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = model;
        existingAccessory.context.device = device;
        existingAccessory.context.deviceID = rainbird!.serialNumber;
        existingAccessory.context.model = model;
        existingAccessory.context.FirmwareRevision = rainbird!.version;
        this.api.updatePlatformAccessories([existingAccessory]);
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new LeakSensor(this, existingAccessory, device, rainbird);
        this.device(`Leak Sensor uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`);

      } else {
        this.unregisterPlatformAccessories(existingAccessory);
      }
    } else if (!this.config.disablePlugin && device.showRainSensor) {
      // the accessory does not yet exist, so we need to create it
      this.log.info(`Adding new accessory: ${model}`);

      // create a new accessory
      const accessory = new this.api.platformAccessory(model, uuid);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.context.device = device;
      accessory.context.deviceID = rainbird!.serialNumber;
      accessory.context.model = model;
      accessory.context.FirmwareRevision = rainbird!.version;
      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      new LeakSensor(this, accessory, device, rainbird);
      this.device(`Leak Sensor uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${accessory.UUID})`);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    } else {
      if (this.config.options?.debug === 'debug' && device.showRainSensor) {
        this.log.error(`Unable to Register new device: ${model}`);
      }
    }
  }

  createContactSensor(device: DevicesConfig, rainbird: RainBirdService, zoneId: number): void {
    const model = `${rainbird!.model}-${zoneId}`;
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`);
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);

    if (existingAccessory) {
      // the accessory already exists
      if (!this.config.disablePlugin && device.showValveSensor) {
        this.log.info(`Restoring existing accessory from cache: ${existingAccessory.displayName}`);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = model;
        existingAccessory.context.device = device;
        existingAccessory.context.deviceID = rainbird!.serialNumber;
        existingAccessory.context.model = model;
        existingAccessory.context.FirmwareRevision = rainbird!.version;
        existingAccessory.context.zoneId = zoneId;
        this.api.updatePlatformAccessories([existingAccessory]);
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new ContactSensor(this, existingAccessory, device, rainbird);
        this.device(`Contact Sensor uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`);

      } else {
        this.unregisterPlatformAccessories(existingAccessory);
      }
    } else if (!this.config.disablePlugin && device.showValveSensor) {
      // the accessory does not yet exist, so we need to create it
      this.log.info(`Adding new accessory: ${model}`);

      // create a new accessory
      const accessory = new this.api.platformAccessory(model, uuid);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.context.device = device;
      accessory.context.deviceID = rainbird!.serialNumber;
      accessory.context.model = model;
      accessory.context.FirmwareRevision = rainbird!.version;
      accessory.context.zoneId = zoneId;
      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      new ContactSensor(this, accessory, device, rainbird);
      this.device(`Contact Sensor uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${accessory.UUID})`);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    } else {
      if (this.config.options?.debug === 'debug' && device.showValveSensor) {
        this.log.error(`Unable to Register new device: ${rainbird!.model}-${zoneId}`);
      }
    }
  }

  createProgramSwitch(device: DevicesConfig, rainbird: RainBirdService, programId: string): void {
    const model = `${rainbird!.model}-pgm-${programId}`;
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`);
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);
    const showProgramSwitch = device[`showProgram${programId}Switch`];

    if (existingAccessory) {
      // the accessory already exists
      if (!this.config.disablePlugin && showProgramSwitch) {
        this.log.info(`Restoring existing accessory from cache: ${existingAccessory.displayName}`);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = model;
        existingAccessory.context.device = device;
        existingAccessory.context.deviceID = rainbird!.serialNumber;
        existingAccessory.context.model = model;
        existingAccessory.context.FirmwareRevision = rainbird!.version;
        existingAccessory.context.programId = programId;
        this.api.updatePlatformAccessories([existingAccessory]);
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new ProgramSwitch(this, existingAccessory, device, rainbird);
        this.device(`Program Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`);
      } else {
        this.unregisterPlatformAccessories(existingAccessory);
      }
    } else if (!this.config.disablePlugin && showProgramSwitch) {
      // the accessory does not yet exist, so we need to create it
      this.log.info(`Adding new accessory: ${model}`);

      // create a new accessory
      const accessory = new this.api.platformAccessory(model, uuid);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.context.device = device;
      accessory.context.deviceID = rainbird!.serialNumber;
      accessory.context.model = model;
      accessory.context.FirmwareRevision = rainbird!.version;
      accessory.context.programId = programId;

      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      new ProgramSwitch(this, accessory, device, rainbird);
      this.device(`Program Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${accessory.UUID})`);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    } else {
      if (this.config.options?.debug === 'debug' && showProgramSwitch) {
        this.log.error(`Unable to Register new device: ${model}`);
      }
    }
  }

  public unregisterPlatformAccessories(existingAccessory: PlatformAccessory) {
    // remove platform accessories when no longer present
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
    this.log.warn('Removing existing accessory from cache:', existingAccessory.displayName);
  }

  /**
   * If debug level logging is turned on, log to log.info
   * Otherwise send debug logs to log.debug
   * this.debugMode = process.argv.includes('-D') || process.argv.includes('--debug');
   */
  debug(...log: any[]) {
    if (this.config.options?.debug === 'debug') {
      this.log.info('[DEBUG]', String(...log));
    } else {
      this.log.debug(String(...log));
    }
  }

  /**
   * If device level logging is turned on, log to log.warn
   * Otherwise send debug logs to log.debug
   */
  device(...log: any[]) {
    if (this.config.options?.debug === 'device') {
      this.log.warn('[DEVICE]', String(...log));
    } else {
      this.log.debug(String(...log));
    }
  }
}

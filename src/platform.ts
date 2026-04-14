/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * platform.ts: @homebridge-plugins/homebridge-rainbird.
 */
import type { API, DynamicPlatformPlugin, HAP, Logging, PlatformAccessory } from 'homebridge'

import type { devicesConfig, RainbirdPlatformConfig } from './settings.js'

import { readFileSync } from 'node:fs'
import { argv } from 'node:process'

import { LogLevel, RainBirdService } from 'rainbird'

import { ContactSensor } from './devices/ContactSensor.js'
import { DelayIrrigationSwitch } from './devices/DelayIrrigationSwitch.js'
import { IrrigationSystem } from './devices/IrrigationSystem.js'
import { LeakSensor } from './devices/LeakSensor.js'
import { ProgramSwitch } from './devices/ProgramSwitch.js'
import { StopIrrigationSwitch } from './devices/StopIrrigationSwitch.js'
import { TestZoneSwitch } from './devices/TestZoneSwitch.js'
import { ZoneValve } from './devices/ZoneValve.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'

interface ControllerCapabilities {
  supportsControllerFirmwareVersion: boolean
  supportsRetrieveSchedule: boolean
  supportsWaterBudget: boolean
  supportsZonesSeasonalAdjustFactor: boolean
  supportsTestZone: boolean
  supportsControllerEventTimestamp: boolean
  supportsStackRunZone: boolean
}

const COMMAND_ID_CONTROLLER_FIRMWARE_VERSION = 0x0B
const COMMAND_ID_RETRIEVE_SCHEDULE = 0x20
const COMMAND_ID_WATER_BUDGET = 0x30
const COMMAND_ID_ZONES_SEASONAL_ADJUST_FACTOR = 0x32
const COMMAND_ID_TEST_ZONE = 0x3A
const COMMAND_ID_CONTROLLER_EVENT_TIMESTAMP = 0x4A
const COMMAND_ID_STACK_RUN_ZONE = 0x4B
const UNKNOWN_FIRMWARE_VERSION = 'Unknown'

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class RainbirdPlatform implements DynamicPlatformPlugin {
  public accessories: PlatformAccessory[]
  private readonly handlers: object[] = []
  private readonly controllerCapabilities = new Map<string, ControllerCapabilities>()
  public readonly api: API
  public readonly log: Logging
  protected readonly hap: HAP
  public config!: RainbirdPlatformConfig

  platformConfig!: RainbirdPlatformConfig
  platformLogging!: RainbirdPlatformConfig['logging']
  platformRefreshRate!: RainbirdPlatformConfig['refreshRate']
  platformPushRate!: RainbirdPlatformConfig['pushRate']
  platformUpdateRate!: RainbirdPlatformConfig['updateRate']
  debugMode!: boolean
  version!: string

  constructor(
    log: Logging,
    config: RainbirdPlatformConfig,
    api: API,
  ) {
    this.accessories = []
    this.api = api
    this.hap = this.api.hap
    this.log = log
    // only load if configured
    if (!config) {
      return
    }

    // Plugin options into our config variables.
    this.config = {
      platform: 'Rainbird',
      name: config.name,
      devices: config.devices,
      options: config.options,
    }

    // Plugin Configuration
    this.getPlatformLogSettings()
    this.getPlatformRateSettings()
    this.getPlatformConfigSettings()
    this.getVersion()

    // Finish initializing the platform
    this.debugLog(`Finished initializing platform: ${config.name}`);

    // verify the config
    (async () => {
      try {
        this.verifyConfig()
        this.debugLog('Config OK')
      } catch (e: any) {
        this.errorLog(`Verify Config, Error Message: ${e.message}, Submit Bugs Here: https://bit.ly/homebridge-rainbird-bug-report`)
        this.debugErrorLog(`Verify Config, Error: ${e}`)
      }
    })()

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      this.debugLog('Executed didFinishLaunching callback')
      try {
        await this.discoverDevices()
      } catch (e: any) {
        this.errorLog(`Failed to Discover Devices, ${JSON.stringify(e.message)}`)
        this.debugLog(JSON.stringify(e))
      }
    })
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.infoLog(`Loading accessory from cache: ${accessory.displayName}`)

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory)
  }

  private registerHandler<T extends object>(handler: T): T {
    this.handlers.push(handler)
    return handler
  }

  private createPlatformAccessory(displayName: string, uuid: string): PlatformAccessory {
    const PlatformAccessoryCtor = this.api.platformAccessory
    return new PlatformAccessoryCtor(displayName, uuid)
  }

  public supportsStackRunZone(deviceId: string): boolean {
    return this.controllerCapabilities.get(deviceId)?.supportsStackRunZone ?? false
  }

  private async detectControllerCapabilities(rainbird: RainBirdService): Promise<ControllerCapabilities> {
    const capabilities: ControllerCapabilities = {
      supportsControllerFirmwareVersion: await rainbird.getCommandSupport(COMMAND_ID_CONTROLLER_FIRMWARE_VERSION),
      supportsRetrieveSchedule: await rainbird.getCommandSupport(COMMAND_ID_RETRIEVE_SCHEDULE),
      supportsWaterBudget: await rainbird.getCommandSupport(COMMAND_ID_WATER_BUDGET),
      supportsZonesSeasonalAdjustFactor: await rainbird.getCommandSupport(COMMAND_ID_ZONES_SEASONAL_ADJUST_FACTOR),
      supportsTestZone: await rainbird.getCommandSupport(COMMAND_ID_TEST_ZONE),
      supportsControllerEventTimestamp: await rainbird.getCommandSupport(COMMAND_ID_CONTROLLER_EVENT_TIMESTAMP),
      supportsStackRunZone: await rainbird.getCommandSupport(COMMAND_ID_STACK_RUN_ZONE),
    }
    return capabilities
  }

  private async logControllerEnhancements(rainbird: RainBirdService, capabilities: ControllerCapabilities): Promise<void> {
    this.debugLog(`Controller capabilities: ${JSON.stringify(capabilities)}`)

    if (capabilities.supportsWaterBudget) {
      for (const program of [0, 1, 2, 3]) {
        const waterBudget = await rainbird.getWaterBudget(program)
        this.debugLog(`Program ${program} water budget: ${waterBudget}%`)
      }
    }

    if (capabilities.supportsZonesSeasonalAdjustFactor) {
      for (const program of [0, 1, 2, 3]) {
        const seasonalAdjust = await rainbird.getZonesSeasonalAdjustFactor(program)
        if (seasonalAdjust.length > 0) {
          this.debugLog(`Program ${program} zones seasonal adjust: ${JSON.stringify(seasonalAdjust)}`)
        }
      }
    }

    if (capabilities.supportsControllerEventTimestamp) {
      const timestamp = await rainbird.getControllerEventTimestamp(0)
      if (timestamp > 0) {
        this.debugLog(`Controller event timestamp(0): ${new Date(timestamp * 1000).toISOString()}`)
      }
    }
  }

  /**
   * Verify the config passed to the plugin is valid
   */
  verifyConfig() {
    this.initialiseConfig()

    if (this.config.devices) {
      for (const device of this.config.devices!) {
        if (!device.ipaddress) {
          throw new Error('The devices config section is missing the "IP Address" in the config, and will be skipped.')
        }
        if (!device.password) {
          throw new Error('The devices config section is missing the "Password" in the config, and will be skipped.')
        }
      }
    } else {
      throw new Error('The devices config section is missing from the config. This device will be skipped.')
    }

    this.config.options = this.config.options || {}

    if (!this.config.options.refreshRate) {
      // default 300 seconds (5 minutes)
      this.config.options!.refreshRate! = 300
      this.debugLog('Using Default Refresh Rate.')
    }

    if (!this.config.options.pushRate) {
      // default 100 milliseconds
      this.config.options!.pushRate! = 0.1
      this.debugLog('Using Default Push Rate.')
    }
  }

  private initialiseConfig(): void {
    for (const device of this.config.devices ?? []) {
      device.showRainSensor = device.showRainSensor ?? false
      device.showValveSensor = device.showValveSensor ?? false
      device.showProgramASwitch = device.showProgramASwitch ?? false
      device.showProgramBSwitch = device.showProgramBSwitch ?? false
      device.showProgramCSwitch = device.showProgramCSwitch ?? false
      device.showProgramDSwitch = device.showProgramDSwitch ?? false
      device.showStopIrrigationSwitch = device.showStopIrrigationSwitch ?? false
      device.showZoneValve = device.showZoneValve ?? false
      device.includeZones = device.includeZones ?? ''
      device.showDelayIrrigationSwitch = device.showDelayIrrigationSwitch ?? false
      device.irrigationDelay = device.irrigationDelay ?? 1
      device.showTestZoneSwitch = device.showTestZoneSwitch ?? false
      device.syncTime = device.syncTime ?? false
      device.showRequestResponse = device.showRequestResponse ?? false
      device.minValueRemainingDuration = device.minValueRemainingDuration ?? 0
      device.maxValueRemainingDuration = device.maxValueRemainingDuration ?? 3600
    }
  }

  /**
   * This method is used to discover the your location and devices.
   */
  protected async discoverDevices(): Promise<void> {
    for (const device of this.config.devices!) {
      try {
        const rainbird = new RainBirdService({
          address: device.ipaddress!,
          password: device.password!,
          refreshRate: this.config.options!.refreshRate,
          showRequestResponse: device.showRequestResponse!,
          syncTime: device.syncTime!,
        })
        // Listen for log events
        rainbird.on('log', (log) => {
          switch (log.level) {
            case LogLevel.ERROR:
              this.errorLog(`From Rainbird Library: ${log.message}`)
              break
            case LogLevel.WARN:
              this.warnLog(`From Rainbird Library: ${log.message}`)
              break
            case LogLevel.DEBUG:
              this.debugLog(`From Rainbird Library: ${log.message}`)
              break
            case LogLevel.INFO:
            default:
              this.infoLog(`From Rainbird Library: ${log.message}`)
          }
        })
        const metaData = await rainbird.init()
        this.debugLog(JSON.stringify(metaData))
        const capabilities = await this.detectControllerCapabilities(rainbird)
        this.controllerCapabilities.set(metaData.serialNumber, capabilities)
        await this.logControllerEnhancements(rainbird, capabilities)

        // Display device details
        this.infoLog(`Model: ${metaData.model}, [Version: ${metaData.version}, Serial Number: ${metaData.serialNumber}, Zones: ${JSON.stringify(metaData.zones)}]`)
        const irrigationAccessory = this.createIrrigationSystem(device, rainbird)
        this.createLeakSensor(device, rainbird)
        for (const zoneId of metaData.zones) {
          const configured = (await irrigationAccessory)!.context.configured[zoneId] ?? this.hap.Characteristic.IsConfigured.CONFIGURED
          if (configured === this.hap.Characteristic.IsConfigured.CONFIGURED) {
            this.createZoneValve(device, rainbird, zoneId)
            this.createContactSensor(device, rainbird, zoneId)
            this.createTestZoneSwitch(device, rainbird, zoneId, capabilities.supportsTestZone)
          }
        }
        for (const programId of ['A', 'B', 'C', 'D']) {
          this.createProgramSwitch(device, rainbird, programId)
        }
        this.createStopIrrigationSwitch(device, rainbird)
        this.createDelayIrrigationSwitch(device, rainbird)

        // Handle zone enable/disable
        rainbird.on('zone_enable', (zoneId, enabled) => {
          if (enabled) {
            this.createContactSensor(device, rainbird, zoneId)
            this.createTestZoneSwitch(device, rainbird, zoneId, capabilities.supportsTestZone)
            // this.createZoneValve(device, rainbird, zoneId);
          } else {
            this.removeContactSensor(device, rainbird, zoneId)
            this.removeTestZoneSwitch(device, rainbird, zoneId)
            // this.removeZoneValve(device, rainbird, zoneId);
          }
        })
      } catch (e: any) {
        this.errorLog(`Failed to connect to RainBird controller at ${device.ipaddress}: ${e.message}`)

        // Provide specific troubleshooting guidance based on error type
        if (e.message?.includes('ECONNREFUSED')) {
          this.errorLog('Connection refused - Troubleshooting steps:')
          this.errorLog('  1. Verify the RainBird controller is powered on and connected to your network')
          this.errorLog('  2. Check that the IP address in your config matches your controller\'s actual IP')
          this.errorLog('  3. Ensure your controller is accessible from this device (try pinging the IP)')
          this.errorLog('  4. Verify the RainBird LNK WiFi module is properly installed and functioning')
          this.errorLog('  5. Check if your router has "Band Steering" enabled and try disabling it')
          this.errorLog('  6. Ensure your WiFi network is not using channel 13 (not supported by some RainBird modules)')
          this.errorLog('  7. Close the RainBird mobile app if it\'s running (can cause connectivity conflicts)')
        } else if (e.message?.includes('ETIMEDOUT') || e.message?.includes('timeout')) {
          this.errorLog('Connection timeout - The controller may be slow to respond or overloaded')
          this.errorLog('  Try restarting the RainBird controller and check your network connection')
        } else if (e.message?.includes('EHOSTUNREACH')) {
          this.errorLog('Host unreachable - Check your network configuration and firewall settings')
        } else {
          this.errorLog('Connection error - Please check your controller configuration and network settings')
        }

        this.errorLog(`Skipping device at ${device.ipaddress} and continuing with other devices...`)
        continue
      }
    }
  }

  private async createIrrigationSystem(device: devicesConfig, rainbird: RainBirdService) {
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${rainbird!.model}-${rainbird!.serialNumber}`)
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      if (!device.hide_device) {
        this.infoLog(`Restoring existing accessory from cache: ${existingAccessory.displayName}`)

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = device.configDeviceName
          ? await this.validateAndCleanDisplayName(device.configDeviceName, 'configDeviceName', device.configDeviceName)
          : await this.validateAndCleanDisplayName(rainbird.model, 'model', rainbird.model)
        existingAccessory.context.device = device
        existingAccessory.context.deviceID = rainbird!.serialNumber
        existingAccessory.context.model = rainbird!.model
        existingAccessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
        this.api.updatePlatformAccessories([existingAccessory])
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.registerHandler(new IrrigationSystem(this, existingAccessory, device, rainbird))
        this.debugLog(`Irrigation System uuid: ${device.ipaddress}-${rainbird!.model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
        return existingAccessory
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.hide_device) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${rainbird!.model}`)

      // create a new accessory
      const accessory = this.createPlatformAccessory(rainbird!.model, uuid)

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.displayName = device.configDeviceName
        ? await this.validateAndCleanDisplayName(device.configDeviceName, 'configDeviceName', device.configDeviceName)
        : await this.validateAndCleanDisplayName(rainbird.model, 'model', rainbird.model)
      accessory.context.device = device
      accessory.context.deviceID = rainbird!.serialNumber
      accessory.context.model = rainbird!.model
      accessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      this.registerHandler(new IrrigationSystem(this, accessory, device, rainbird))
      this.debugLog(`Irrigation System uuid: ${device.ipaddress}-${rainbird!.model}-${rainbird!.serialNumber}, (${accessory.UUID})`)

      // link the accessory to your platform
      this.externalOrPlatform(device, accessory)
      this.accessories.push(accessory)
      return accessory
    } else {
      if (this.platformLogging === 'debug') {
        this.errorLog(`Unable to Register new device: ${rainbird!.model}`)
      }
    }
  }

  private async createLeakSensor(device: devicesConfig, rainbird: RainBirdService): Promise<void> {
    const model = 'WR2'
    const leakSensorModel = `${model} Leak Sensor`
    const leakSensorConfigName = device.configDeviceName ? `${device.configDeviceName} Leak Sensor` : 'Leak Sensor'
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      if (!device.hide_device && device.showRainSensor) {
        this.infoLog(`Restoring existing accessory from cache: ${existingAccessory.displayName}`)

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = leakSensorConfigName
          ? await this.validateAndCleanDisplayName(leakSensorConfigName, 'configDeviceName Leak Sensor', leakSensorConfigName)
          : await this.validateAndCleanDisplayName(leakSensorModel, leakSensorModel, leakSensorModel)
        existingAccessory.context.device = device
        existingAccessory.context.deviceID = rainbird!.serialNumber
        existingAccessory.context.model = model
        existingAccessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
        this.api.updatePlatformAccessories([existingAccessory])
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.registerHandler(new LeakSensor(this, existingAccessory, device, rainbird))
        this.debugLog(`Leak Sensor uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.hide_device && device.showRainSensor) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = this.createPlatformAccessory(model, uuid)

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.displayName = leakSensorConfigName
        ? await this.validateAndCleanDisplayName(leakSensorConfigName, 'configDeviceName Leak Sensor', leakSensorConfigName)
        : await this.validateAndCleanDisplayName(leakSensorModel, leakSensorModel, leakSensorModel)
      accessory.context.device = device
      accessory.context.deviceID = rainbird!.serialNumber
      accessory.context.model = model
      accessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      this.registerHandler(new LeakSensor(this, accessory, device, rainbird))
      this.debugLog(`Leak Sensor uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${accessory.UUID})`)

      // link the accessory to your platform
      this.externalOrPlatform(device, accessory)
      this.accessories.push(accessory)
    } else {
      if (this.platformLogging === 'debug' && device.showRainSensor) {
        this.errorLog(`Unable to Register new device: ${model}`)
      }
    }
  }

  async FirmwareRevision(rainbird: RainBirdService, device: devicesConfig): Promise<string> {
    if (device.firmware) {
      return String(device.firmware)
    }
    const controllerFirmwareVersion = await rainbird.getControllerFirmwareVersion()
    if (controllerFirmwareVersion && controllerFirmwareVersion !== UNKNOWN_FIRMWARE_VERSION) {
      return controllerFirmwareVersion
    }
    return String(rainbird.version ?? this.version)
  }

  async createZoneValve(device: devicesConfig, rainbird: RainBirdService, zoneId: number): Promise<void> {
    const model = `${rainbird!.model}-valve-${zoneId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = `Zone ${zoneId}`
    const valveConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : 'Valve'
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    const irrigationUuid = this.api.hap.uuid.generate(`${device.ipaddress}-${rainbird!.model}-${rainbird!.serialNumber}`)
    const irrigationAccessory = this.accessories.find(accessory => accessory.UUID === irrigationUuid)

    const includeZones = device.includeZones!.split(',').map(Number)
    const registerZoneValve = !device.hide_device
      && device.showZoneValve
      && (includeZones.includes(0) || includeZones.includes(zoneId))

    if (existingAccessory) {
      // the accessory already exists
      if (registerZoneValve) {
        this.infoLog(`Restoring existing accessory from cache: ${existingAccessory.displayName}`)

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = valveConfigName
          ? await this.validateAndCleanDisplayName(valveConfigName, `configDeviceName ${name}`, `${device.configDeviceName} ${name}`)
          : await this.validateAndCleanDisplayName(name, `${name} name`, name)
        existingAccessory.context.device = device
        existingAccessory.context.deviceID = rainbird!.serialNumber
        existingAccessory.context.model = model
        existingAccessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
        existingAccessory.context.zoneId = zoneId
        this.api.updatePlatformAccessories([existingAccessory])
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.registerHandler(new ZoneValve(this, existingAccessory, device, rainbird, irrigationAccessory!.context))
        this.debugLog(`Zone Valve uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (registerZoneValve) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = this.createPlatformAccessory(name, uuid)

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.displayName = valveConfigName
        ? await this.validateAndCleanDisplayName(valveConfigName, `configDeviceName ${name}`, `${device.configDeviceName} ${name}`)
        : await this.validateAndCleanDisplayName(name, `${name} name`, name)
      accessory.context.device = device
      accessory.context.deviceID = rainbird!.serialNumber
      accessory.context.model = model
      accessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
      accessory.context.zoneId = zoneId
      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      this.registerHandler(new ZoneValve(this, accessory, device, rainbird, irrigationAccessory!.context))
      this.debugLog(`Valve Zone uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${accessory.UUID})`)

      // link the accessory to your platform
      this.externalOrPlatform(device, accessory)
      this.accessories.push(accessory)
    } else {
      if (this.platformLogging === 'debug' && device.showZoneValve) {
        this.errorLog(`Unable to Register new device: ${model}`)
      }
    }
  }

  removeZoneValve(device: devicesConfig, rainbird: RainBirdService, zoneId: number): void {
    const model = `${rainbird!.model}-valve-${zoneId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const index = this.accessories.findIndex(accessory => accessory.UUID === uuid)
    if (index >= 0) {
      this.unregisterPlatformAccessories(this.accessories[index])
      this.accessories.splice(index, 1)
    }
  }

  async createContactSensor(device: devicesConfig, rainbird: RainBirdService, zoneId: number): Promise<void> {
    const model = `${rainbird!.model}-${zoneId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = `Zone ${zoneId}`
    const contactSensorConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : 'Contact Sensor'
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      if (!device.hide_device && device.showValveSensor) {
        this.infoLog(`Restoring existing accessory from cache: ${existingAccessory.displayName}`)

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = contactSensorConfigName
          ? await this.validateAndCleanDisplayName(contactSensorConfigName, `configDeviceName ${name}`, contactSensorConfigName)
          : await this.validateAndCleanDisplayName(name, `${name} name`, name)
        existingAccessory.context.device = device
        existingAccessory.context.deviceID = rainbird!.serialNumber
        existingAccessory.context.model = model
        existingAccessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
        existingAccessory.context.zoneId = zoneId
        this.api.updatePlatformAccessories([existingAccessory])
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.registerHandler(new ContactSensor(this, existingAccessory, device, rainbird))
        this.debugLog(`Contact Sensor uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.hide_device && device.showValveSensor) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = this.createPlatformAccessory(model, uuid)

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.displayName = contactSensorConfigName
        ? await this.validateAndCleanDisplayName(contactSensorConfigName, `configDeviceName ${name}`, contactSensorConfigName)
        : await this.validateAndCleanDisplayName(name, `${name} name`, name)
      accessory.context.device = device
      accessory.context.deviceID = rainbird!.serialNumber
      accessory.context.model = model
      accessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
      accessory.context.zoneId = zoneId
      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      this.registerHandler(new ContactSensor(this, accessory, device, rainbird))
      this.debugLog(`Contact Sensor uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${accessory.UUID})`)

      // link the accessory to your platform
      this.externalOrPlatform(device, accessory)
      this.accessories.push(accessory)
    } else {
      if (this.platformLogging === 'debug' && device.showValveSensor) {
        this.errorLog(`Unable to Register new device: ${rainbird!.model}-${zoneId}`)
      }
    }
  }

  removeContactSensor(device: devicesConfig, rainbird: RainBirdService, zoneId: number): void {
    const model = `${rainbird!.model}-${zoneId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const index = this.accessories.findIndex(accessory => accessory.UUID === uuid)
    if (index >= 0) {
      this.unregisterPlatformAccessories(this.accessories[index])
      this.accessories.splice(index, 1)
    }
  }

  async createTestZoneSwitch(device: devicesConfig, rainbird: RainBirdService, zoneId: number, supportsTestZone: boolean): Promise<void> {
    const model = `${rainbird!.model}-test-${zoneId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = `Zone ${zoneId} Test`
    const testSwitchConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : 'Test Zone Switch'
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      if (!device.hide_device && device.showTestZoneSwitch && supportsTestZone) {
        this.infoLog(`Restoring existing accessory from cache: ${existingAccessory.displayName}`)
        existingAccessory.displayName = testSwitchConfigName
          ? await this.validateAndCleanDisplayName(testSwitchConfigName, `configDeviceName ${name}`, testSwitchConfigName)
          : await this.validateAndCleanDisplayName(name, `${name} name`, name)
        existingAccessory.context.device = device
        existingAccessory.context.deviceID = rainbird!.serialNumber
        existingAccessory.context.model = model
        existingAccessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
        existingAccessory.context.zoneId = zoneId
        this.api.updatePlatformAccessories([existingAccessory])
        this.registerHandler(new TestZoneSwitch(this, existingAccessory, device, rainbird))
        this.debugLog(`Test Zone Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.hide_device && device.showTestZoneSwitch && supportsTestZone) {
      this.infoLog(`Adding new accessory: ${model}`)
      const accessory = this.createPlatformAccessory(model, uuid)
      accessory.displayName = testSwitchConfigName
        ? await this.validateAndCleanDisplayName(testSwitchConfigName, `configDeviceName ${name}`, testSwitchConfigName)
        : await this.validateAndCleanDisplayName(name, `${name} name`, name)
      accessory.context.device = device
      accessory.context.deviceID = rainbird!.serialNumber
      accessory.context.model = model
      accessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
      accessory.context.zoneId = zoneId
      this.registerHandler(new TestZoneSwitch(this, accessory, device, rainbird))
      this.debugLog(`Test Zone Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${accessory.UUID})`)
      this.externalOrPlatform(device, accessory)
      this.accessories.push(accessory)
    } else {
      if (this.platformLogging.includes('debug') && device.showTestZoneSwitch) {
        if (!supportsTestZone) {
          this.warnLog(`Skipping Test Zone switch for ${rainbird.model}: controller does not support command 0x${COMMAND_ID_TEST_ZONE.toString(16).toUpperCase()}`)
          return
        }
        this.errorLog(`Unable to Register new device: ${model}`)
      }
    }
  }

  removeTestZoneSwitch(device: devicesConfig, rainbird: RainBirdService, zoneId: number): void {
    const model = `${rainbird!.model}-test-${zoneId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const index = this.accessories.findIndex(accessory => accessory.UUID === uuid)
    if (index >= 0) {
      this.unregisterPlatformAccessories(this.accessories[index])
      this.accessories.splice(index, 1)
    }
  }

  async createProgramSwitch(device: devicesConfig, rainbird: RainBirdService, programId: string): Promise<void> {
    const model = `${rainbird!.model}-pgm-${programId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = `Program ${programId}`
    const programSwitchConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : 'Program Switch'
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)
    const showProgramSwitch = device[`showProgram${programId}Switch`]

    if (existingAccessory) {
      // the accessory already exists
      if (!device.hide_device && showProgramSwitch) {
        this.infoLog(`Restoring existing accessory from cache: ${existingAccessory.displayName}`)

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = programSwitchConfigName
          ? await this.validateAndCleanDisplayName(programSwitchConfigName, `configDeviceName ${name}`, programSwitchConfigName)
          : await this.validateAndCleanDisplayName(name, `${name} name`, name)
        existingAccessory.context.device = device
        existingAccessory.context.deviceID = rainbird!.serialNumber
        existingAccessory.context.model = model
        existingAccessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
        existingAccessory.context.programId = programId
        this.api.updatePlatformAccessories([existingAccessory])
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.registerHandler(new ProgramSwitch(this, existingAccessory, device, rainbird))
        this.debugLog(`Program Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.hide_device && showProgramSwitch) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = this.createPlatformAccessory(model, uuid)

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.displayName = programSwitchConfigName
        ? await this.validateAndCleanDisplayName(programSwitchConfigName, `configDeviceName ${name}`, programSwitchConfigName)
        : await this.validateAndCleanDisplayName(name, `${name} name`, name)
      accessory.context.device = device
      accessory.context.deviceID = rainbird!.serialNumber
      accessory.context.model = model
      accessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
      accessory.context.programId = programId

      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      this.registerHandler(new ProgramSwitch(this, accessory, device, rainbird))
      this.debugLog(`Program Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${accessory.UUID})`)

      // link the accessory to your platform
      this.externalOrPlatform(device, accessory)
      this.accessories.push(accessory)
    } else {
      if (this.platformLogging.includes('debug') && showProgramSwitch) {
        this.errorLog(`Unable to Register new device: ${model}`)
      }
    }
  }

  async createStopIrrigationSwitch(device: devicesConfig, rainbird: RainBirdService): Promise<void> {
    const model = `${rainbird!.model}-stop`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = 'Stop Irrigation'
    const stopSwitchConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : 'Stop Switch'
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      if (!device.hide_device && device.showStopIrrigationSwitch) {
        this.infoLog(`Restoring existing accessory from cache: ${existingAccessory.displayName}`)

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = stopSwitchConfigName
          ? await this.validateAndCleanDisplayName(stopSwitchConfigName, `configDeviceName ${name}`, stopSwitchConfigName)
          : await this.validateAndCleanDisplayName(name, `${name} name`, name)
        existingAccessory.context.device = device
        existingAccessory.context.deviceID = rainbird!.serialNumber
        existingAccessory.context.model = model
        existingAccessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
        this.api.updatePlatformAccessories([existingAccessory])
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.registerHandler(new StopIrrigationSwitch(this, existingAccessory, device, rainbird))
        this.debugLog(`Stop Irrigation Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.hide_device && device.showStopIrrigationSwitch) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = this.createPlatformAccessory(model, uuid)

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.displayName = stopSwitchConfigName
        ? await this.validateAndCleanDisplayName(stopSwitchConfigName, `configDeviceName ${name}`, stopSwitchConfigName)
        : await this.validateAndCleanDisplayName(name, `${name} name`, name)
      accessory.context.device = device
      accessory.context.deviceID = rainbird!.serialNumber
      accessory.context.model = model
      accessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)

      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      this.registerHandler(new StopIrrigationSwitch(this, accessory, device, rainbird))
      this.debugLog(`Stop Irrigation Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${accessory.UUID})`)

      // link the accessory to your platform
      this.externalOrPlatform(device, accessory)
      this.accessories.push(accessory)
    } else {
      if (this.platformLogging.includes('debug') && device.showStopIrrigationSwitch) {
        this.errorLog(`Unable to Register new device: ${model}`)
      }
    }
  }

  async createDelayIrrigationSwitch(device: devicesConfig, rainbird: RainBirdService): Promise<void> {
    const model = `${rainbird!.model}-delay`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = 'Delay Irrigation'
    const delaySwitchConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : 'Delay Switch'
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      if (!device.hide_device && device.showDelayIrrigationSwitch) {
        this.infoLog(`Restoring existing accessory from cache: ${existingAccessory.displayName}`)

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.displayName = delaySwitchConfigName
          ? await this.validateAndCleanDisplayName(delaySwitchConfigName, `configDeviceName ${name}`, delaySwitchConfigName)
          : await this.validateAndCleanDisplayName(name, `${name} name`, name)
        existingAccessory.context.device = device
        existingAccessory.context.deviceID = rainbird!.serialNumber
        existingAccessory.context.model = model
        existingAccessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)
        this.api.updatePlatformAccessories([existingAccessory])
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.registerHandler(new DelayIrrigationSwitch(this, existingAccessory, device, rainbird))
        this.debugLog(`Delay Irrigation Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.hide_device && device.showDelayIrrigationSwitch) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = this.createPlatformAccessory(model, uuid)

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.displayName = delaySwitchConfigName
        ? await this.validateAndCleanDisplayName(delaySwitchConfigName, `configDeviceName ${name}`, delaySwitchConfigName)
        : await this.validateAndCleanDisplayName(name, `${name} name`, name)
      accessory.context.device = device
      accessory.context.deviceID = rainbird!.serialNumber
      accessory.context.model = model
      accessory.context.FirmwareRevision = await this.FirmwareRevision(rainbird, device)

      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      this.registerHandler(new DelayIrrigationSwitch(this, accessory, device, rainbird))
      this.debugLog(`Delay Irrigation Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${accessory.UUID})`)

      // link the accessory to your platform
      this.externalOrPlatform(device, accessory)
      this.accessories.push(accessory)
    } else {
      if (this.platformLogging.includes('debug') && device.showDelayIrrigationSwitch) {
        this.errorLog(`Unable to Register new device: ${model}`)
      }
    }
  }

  public async externalOrPlatform(device: devicesConfig, accessory: PlatformAccessory) {
    if (device.external) {
      this.debugWarnLog(`${accessory.displayName} External Accessory Mode`)
      this.externalAccessory(accessory)
    } else {
      this.debugLog(`${accessory.displayName} External Accessory Mode: ${device.external}`)
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
    }
  }

  public async externalAccessory(accessory: PlatformAccessory) {
    this.api.publishExternalAccessories(PLUGIN_NAME, [accessory])
  }

  public unregisterPlatformAccessories(existingAccessory: PlatformAccessory) {
    // remove platform accessories when no longer present
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory])
    this.warnLog(`Removing existing accessory from cache: ${existingAccessory.displayName}`)
  }

  async getPlatformLogSettings() {
    this.debugMode = argv.includes('-D') ?? argv.includes('--debug')
    this.platformLogging = (this.config.options?.logging === 'debug' || this.config.options?.logging === 'standard'
      || this.config.options?.logging === 'none')
      ? this.config.options.logging
      : this.debugMode ? 'debugMode' : 'standard'
    const logging = this.config.options?.logging ? 'Platform Config' : this.debugMode ? 'debugMode' : 'Default'
    await this.debugLog(`Using ${logging} Logging: ${this.platformLogging}`)
  }

  async getPlatformRateSettings() {
    // RefreshRate
    this.platformRefreshRate = this.config.options?.refreshRate ? this.config.options.refreshRate : undefined
    const refreshRate = this.config.options?.refreshRate ? 'Using Platform Config refreshRate' : 'refreshRate Disabled by Default'
    await this.debugLog(`${refreshRate}: ${this.platformRefreshRate}`)
    // UpdateRate
    this.platformUpdateRate = this.config.options?.updateRate ? this.config.options.updateRate : undefined
    const updateRate = this.config.options?.updateRate ? 'Using Platform Config updateRate' : 'Using Default updateRate'
    await this.debugLog(`${updateRate}: ${this.platformUpdateRate}`)
    // PushRate
    this.platformPushRate = this.config.options?.pushRate ? this.config.options.pushRate : undefined
    const pushRate = this.config.options?.pushRate ? 'Using Platform Config pushRate' : 'Using Default pushRate'
    await this.debugLog(`${pushRate}: ${this.platformPushRate}`)
  }

  async getPlatformConfigSettings() {
    if (this.config.options) {
      const platformConfig: RainbirdPlatformConfig = {
        platform: 'Rainbird',
      }
      platformConfig.logging = this.config.options.logging ? this.config.options.logging : undefined
      platformConfig.refreshRate = this.config.options.refreshRate ? this.config.options.refreshRate : undefined
      platformConfig.updateRate = this.config.options.updateRate ? this.config.options.updateRate : undefined
      platformConfig.pushRate = this.config.options.pushRate ? this.config.options.pushRate : undefined
      if (Object.entries(platformConfig).length !== 0) {
        await this.debugLog(`Platform Config: ${JSON.stringify(platformConfig)}`)
      }
      this.platformConfig = platformConfig
    }
  }

  /**
   * Asynchronously retrieves the version of the plugin from the package.json file.
   *
   * This method reads the package.json file located in the parent directory,
   * parses its content to extract the version, and logs the version using the debug logger.
   * The extracted version is then assigned to the `version` property of the class.
   *
   * @returns {Promise<void>} A promise that resolves when the version has been retrieved and logged.
   */
  async getVersion(): Promise<void> {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
    this.debugLog(`Plugin Version: ${version}`)
    this.version = version
  }

  /**
   * Validate and clean a string value for a Name Characteristic.
   * @param displayName - The display name of the accessory.
   * @param name - The name of the characteristic.
   * @param value - The value to be validated and cleaned.
   * @returns The cleaned string value.
   */
  async validateAndCleanDisplayName(displayName: string, name: string, value: string): Promise<string> {
    if (this.config.options?.allowInvalidCharacters) {
      return value
    } else {
      const validPattern = /^[\p{L}\p{N}][\p{L}\p{N} ']*[\p{L}\p{N}]$/u
      const invalidCharsPattern = /[^\p{L}\p{N} ']/gu
      const invalidStartEndPattern = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

      if (typeof value === 'string' && !validPattern.test(value)) {
        this.warnLog(`WARNING: The accessory '${displayName}' has an invalid '${name}' characteristic ('${value}'). Please use only alphanumeric, space, and apostrophe characters. Ensure it starts and ends with an alphabetic or numeric character, and avoid emojis. This may prevent the accessory from being added in the Home App or cause unresponsiveness.`)

        // Remove invalid characters
        if (invalidCharsPattern.test(value)) {
          const before = value
          this.warnLog(`Removing invalid characters from '${name}' characteristic, if you feel this is incorrect,  please enable \'allowInvalidCharacter\' in the config to allow all characters`)
          value = value.replace(invalidCharsPattern, '')
          this.warnLog(`${name} Before: '${before}' After: '${value}'`)
        }

        // Ensure it starts and ends with an alphanumeric character
        if (invalidStartEndPattern.test(value)) {
          const before = value
          this.warnLog(`Removing invalid starting or ending characters from '${name}' characteristic, if you feel this is incorrect, please enable \'allowInvalidCharacter\' in the config to allow all characters`)
          value = value.replace(invalidStartEndPattern, '')
          this.warnLog(`${name} Before: '${before}' After: '${value}'`)
        }
      }

      return value
    }
  }

  /**
   * If device level logging is turned on, log to log.warn
   * Otherwise send debug logs to log.debug
   */
  async infoLog(...log: any[]): Promise<void> {
    if (await this.enablingPlatformLogging()) {
      this.log.info(String(...log))
    }
  }

  async successLog(...log: any[]): Promise<void> {
    if (await this.enablingPlatformLogging()) {
      this.log.success(String(...log))
    }
  }

  async debugSuccessLog(...log: any[]): Promise<void> {
    if (await this.enablingPlatformLogging()) {
      if (await this.loggingIsDebug()) {
        this.log.success('[DEBUG]', String(...log))
      }
    }
  }

  async warnLog(...log: any[]): Promise<void> {
    if (await this.enablingPlatformLogging()) {
      this.log.warn(String(...log))
    }
  }

  async debugWarnLog(...log: any[]): Promise<void> {
    if (await this.enablingPlatformLogging()) {
      if (await this.loggingIsDebug()) {
        this.log.warn('[DEBUG]', String(...log))
      }
    }
  }

  async errorLog(...log: any[]): Promise<void> {
    if (await this.enablingPlatformLogging()) {
      this.log.error(String(...log))
    }
  }

  async debugErrorLog(...log: any[]): Promise<void> {
    if (await this.enablingPlatformLogging()) {
      if (await this.loggingIsDebug()) {
        this.log.error('[DEBUG]', String(...log))
      }
    }
  }

  async debugLog(...log: any[]): Promise<void> {
    if (await this.enablingPlatformLogging()) {
      if (this.platformLogging === 'debugMode') {
        this.log.debug(String(...log))
      } else if (this.platformLogging === 'debug') {
        this.log.info('[DEBUG]', String(...log))
      }
    }
  }

  async loggingIsDebug(): Promise<boolean> {
    return this.platformLogging === 'debugMode' || this.platformLogging === 'debug'
  }

  async enablingPlatformLogging(): Promise<boolean> {
    return this.platformLogging === 'debugMode' || this.platformLogging === 'debug' || this.platformLogging === 'standard'
  }
}

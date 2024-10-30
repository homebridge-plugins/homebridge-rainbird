/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * platform.ts: homebridge-rainbird.
 */
import type { API, DynamicPlatformPlugin, HAP, Logging, PlatformAccessory } from 'homebridge'

import type { DevicesConfig, RainbirdPlatformConfig } from './settings.js'

import { readFileSync } from 'node:fs'
import process from 'node:process'

import { LogLevel, RainBirdService } from 'rainbird'

import { ContactSensor } from './devices/ContactSensor.js'
import { DelayIrrigationSwitch } from './devices/DelayIrrigationSwitch.js'
import { IrrigationSystem } from './devices/IrrigationSystem.js'
import { LeakSensor } from './devices/LeakSensor.js'
import { ProgramSwitch } from './devices/ProgramSwitch.js'
import { StopIrrigationSwitch } from './devices/StopIrrigationSwitch.js'
import { ZoneValve } from './devices/ZoneValve.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class RainbirdPlatform implements DynamicPlatformPlugin {
  public accessories: PlatformAccessory[]
  public readonly api: API
  public readonly log: Logging
  protected readonly hap: HAP
  public config!: RainbirdPlatformConfig

  public sensorData = []

  platformConfig!: RainbirdPlatformConfig['options']
  platformLogging!: RainbirdPlatformConfig['logging']
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
      platform: 'RainbirdPlatform',
      name: config.name,
      devices: config.devices,
      options: config.options,
    }
    this.platformConfigOptions()
    this.platformLogs()
    this.getVersion()
    this.debugLog(`Finished initializing platform: ${config.name}`);

    // verify the config
    (async () => {
      try {
        await this.verifyConfig()
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
      device.syncTime = device.syncTime ?? false
      device.showRequestResponse = device.showRequestResponse ?? false
      device.minValueRemainingDuration = device.minValueRemainingDuration ?? 0
      device.maxValueRemainingDuration = device.maxValueRemainingDuration ?? 3600
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
        showRequestResponse: device.showRequestResponse!,
        syncTime: device.syncTime!,
      })
      // Listen for log events
      rainbird.on('log', (log) => {
        switch (log.level) {
          case LogLevel.ERROR:
            this.errorLog(log.message)
            break
          case LogLevel.WARN:
            this.warnLog(log.message)
            break
          case LogLevel.DEBUG:
            this.debugLog(log.message)
            break
          default:
            this.infoLog(log.message)
        }
      })
      const metaData = await rainbird.init()
      this.debugLog(JSON.stringify(metaData))

      // Display device details
      this.infoLog(`Model: ${metaData.model}, [Version: ${metaData.version}, Serial Number: ${metaData.serialNumber}, Zones: ${JSON.stringify(metaData.zones)}]`)
      const irrigationAccessory = this.createIrrigationSystem(device, rainbird)
      this.createLeakSensor(device, rainbird)
      for (const zoneId of metaData.zones) {
        const configured = (await irrigationAccessory)!.context.configured[zoneId] ?? this.hap.Characteristic.IsConfigured.CONFIGURED
        if (configured === this.hap.Characteristic.IsConfigured.CONFIGURED) {
          this.createZoneValve(device, rainbird, zoneId)
          this.createContactSensor(device, rainbird, zoneId)
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
          // this.createZoneValve(device, rainbird, zoneId);
        } else {
          this.removeContactSensor(device, rainbird, zoneId)
          // this.removeZoneValve(device, rainbird, zoneId);
        }
      })
    }
  }

  private async createIrrigationSystem(device: DevicesConfig, rainbird: RainBirdService) {
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${rainbird!.model}-${rainbird!.serialNumber}`)
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      if (!device.delete) {
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
        new IrrigationSystem(this, existingAccessory, device, rainbird)
        this.debugLog(`Irrigation System uuid: ${device.ipaddress}-${rainbird!.model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
        return existingAccessory
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.delete) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${rainbird!.model}`)

      // create a new accessory
      const accessory = new this.api.platformAccessory(rainbird!.model, uuid)

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
      new IrrigationSystem(this, accessory, device, rainbird)
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

  private async createLeakSensor(device: DevicesConfig, rainbird: RainBirdService): Promise<void> {
    const model = 'WR2'
    const leakSensorModel = `${model} Leak Sensor`
    const leakSensorConfigName = device.configDeviceName ? `${device.configDeviceName} Leak Sensor` : undefined
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      if (!device.delete && device.showRainSensor) {
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
        new LeakSensor(this, existingAccessory, device, rainbird)
        this.debugLog(`Leak Sensor uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.delete && device.showRainSensor) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = new this.api.platformAccessory(model, uuid)

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
      new LeakSensor(this, accessory, device, rainbird)
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

  async FirmwareRevision(rainbird: RainBirdService, device: DevicesConfig): Promise<string> {
    return String(device.firmware ?? rainbird.version ?? this.version)
  }

  async createZoneValve(device: DevicesConfig, rainbird: RainBirdService, zoneId: number): Promise<void> {
    const model = `${rainbird!.model}-valve-${zoneId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = `Zone ${zoneId}`
    const valveConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : undefined
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    const irrigationUuid = this.api.hap.uuid.generate(`${device.ipaddress}-${rainbird!.model}-${rainbird!.serialNumber}`)
    const irrigationAccessory = this.accessories.find(accessory => accessory.UUID === irrigationUuid)

    const includeZones = device.includeZones!.split(',').map(Number)
    const registerZoneValve = !device.delete
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
        new ZoneValve(this, existingAccessory, device, rainbird, irrigationAccessory!.context)
        this.debugLog(`Zone Valve uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (registerZoneValve) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = new this.api.platformAccessory(name, uuid)

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
      new ZoneValve(this, accessory, device, rainbird, irrigationAccessory!.context)
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

  removeZoneValve(device: DevicesConfig, rainbird: RainBirdService, zoneId: number): void {
    const model = `${rainbird!.model}-valve-${zoneId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const index = this.accessories.findIndex(accessory => accessory.UUID === uuid)
    if (index >= 0) {
      this.unregisterPlatformAccessories(this.accessories[index])
      this.accessories.splice(index, 1)
    }
  }

  async createContactSensor(device: DevicesConfig, rainbird: RainBirdService, zoneId: number): Promise<void> {
    const model = `${rainbird!.model}-${zoneId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = `Zone ${zoneId}`
    const contactSensorConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : undefined
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      if (!device.delete && device.showValveSensor) {
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
        new ContactSensor(this, existingAccessory, device, rainbird)
        this.debugLog(`Contact Sensor uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.delete && device.showValveSensor) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = new this.api.platformAccessory(model, uuid)

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
      new ContactSensor(this, accessory, device, rainbird)
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

  removeContactSensor(device: DevicesConfig, rainbird: RainBirdService, zoneId: number): void {
    const model = `${rainbird!.model}-${zoneId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const index = this.accessories.findIndex(accessory => accessory.UUID === uuid)
    if (index >= 0) {
      this.unregisterPlatformAccessories(this.accessories[index])
      this.accessories.splice(index, 1)
    }
  }

  async createProgramSwitch(device: DevicesConfig, rainbird: RainBirdService, programId: string): Promise<void> {
    const model = `${rainbird!.model}-pgm-${programId}`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = `Program ${programId}`
    const programSwitchConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : undefined
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)
    const showProgramSwitch = device[`showProgram${programId}Switch`]

    if (existingAccessory) {
      // the accessory already exists
      if (!device.delete && showProgramSwitch) {
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
        new ProgramSwitch(this, existingAccessory, device, rainbird)
        this.debugLog(`Program Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.delete && showProgramSwitch) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = new this.api.platformAccessory(model, uuid)

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
      new ProgramSwitch(this, accessory, device, rainbird)
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

  async createStopIrrigationSwitch(device: DevicesConfig, rainbird: RainBirdService): Promise<void> {
    const model = `${rainbird!.model}-stop`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = 'Stop Irrigation'
    const stopSwitchConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : undefined
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      if (!device.delete && device.showStopIrrigationSwitch) {
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
        new StopIrrigationSwitch(this, existingAccessory, device, rainbird)
        this.debugLog(`Stop Irrigation Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.delete && device.showStopIrrigationSwitch) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = new this.api.platformAccessory(model, uuid)

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
      new StopIrrigationSwitch(this, accessory, device, rainbird)
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

  async createDelayIrrigationSwitch(device: DevicesConfig, rainbird: RainBirdService): Promise<void> {
    const model = `${rainbird!.model}-delay`
    const uuid = this.api.hap.uuid.generate(`${device.ipaddress}-${model}-${rainbird!.serialNumber}`)
    const name = 'Delay Irrigation'
    const delaySwitchConfigName = device.configDeviceName ? `${device.configDeviceName} ${name}` : undefined
    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      if (!device.delete && device.showDelayIrrigationSwitch) {
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
        new DelayIrrigationSwitch(this, existingAccessory, device, rainbird)
        this.debugLog(`Delay Irrigation Switch uuid: ${device.ipaddress}-${model}-${rainbird!.serialNumber}, (${existingAccessory.UUID})`)
      } else {
        this.unregisterPlatformAccessories(existingAccessory)
      }
    } else if (!device.delete && device.showDelayIrrigationSwitch) {
      // the accessory does not yet exist, so we need to create it
      this.infoLog(`Adding new accessory: ${model}`)

      // create a new accessory
      const accessory = new this.api.platformAccessory(model, uuid)

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
      new DelayIrrigationSwitch(this, accessory, device, rainbird)
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

  public async externalOrPlatform(device: DevicesConfig, accessory: PlatformAccessory) {
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

  async platformConfigOptions() {
    const platformConfig: RainbirdPlatformConfig['options'] = {}
    if (this.config.options) {
      if (this.config.options.logging) {
        platformConfig.logging = this.config.options.logging
      }
      if (this.config.options.refreshRate) {
        platformConfig.refreshRate = this.config.options.refreshRate
      }
      if (this.config.options.pushRate) {
        platformConfig.pushRate = this.config.options.pushRate
      }
      if (this.config.options?.hide_device) {
        platformConfig.hide_device = this.config.options.hide_device
      }
      if (Object.entries(platformConfig).length !== 0) {
        this.debugLog(`Platform Config: ${JSON.stringify(platformConfig)}`)
      }
      this.platformConfig = platformConfig
    }
  }

  async platformLogs() {
    this.debugMode = process.argv.includes('-D') || process.argv.includes('--debug')
    this.platformLogging = this.config.options?.logging ?? 'standard'
    if (this.config.options?.logging === 'debug' || this.config.options?.logging === 'standard' || this.config.options?.logging === 'none') {
      this.platformLogging = this.config.options.logging
      if (await this.loggingIsDebug()) {
        this.debugWarnLog(`Using Config Logging: ${this.platformLogging}`)
      }
    } else if (this.debugMode) {
      this.platformLogging = 'debugMode'
      if (await this.loggingIsDebug()) {
        this.debugWarnLog(`Using ${this.platformLogging} Logging`)
      }
    } else {
      this.platformLogging = 'standard'
      if (await this.loggingIsDebug()) {
        this.debugWarnLog(`Using ${this.platformLogging} Logging`)
      }
    }
    if (this.debugMode) {
      this.platformLogging = 'debugMode'
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
      if (this.platformLogging === 'debug') {
        this.log.info('[DEBUG]', String(...log))
      } else if (this.platformLogging === 'debugMode') {
        this.log.debug(String(...log))
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

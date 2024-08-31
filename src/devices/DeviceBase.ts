/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * DeviceBase.ts: homebridge-rainbird.
 */
import type { API, HAP, Logging, PlatformAccessory } from 'homebridge'
import type { RainBirdService } from 'rainbird'

import type { RainbirdPlatform } from '../platform.js'
import type { DevicesConfig, RainbirdPlatformConfig } from '../settings.js'

export abstract class DeviceBase {
  public readonly api: API
  public readonly log: Logging
  public readonly config!: RainbirdPlatformConfig
  protected readonly hap: HAP

  // Config
  protected deviceLogging!: string
  protected deviceRefreshRate!: number
  protected deviceUpdateRate!: number
  protected devicePushRate!: number

  constructor(
    protected readonly platform: RainbirdPlatform,
    protected accessory: PlatformAccessory,
    protected device: DevicesConfig,
    protected rainbird: RainBirdService,
  ) {
    this.api = this.platform.api
    this.log = this.platform.log
    this.config = this.platform.config
    this.hap = this.api.hap

    this.getDeviceLogSettings(accessory, device)
    this.getDeviceRateSettings(accessory, device)
    this.getDeviceConfigSettings(accessory, device)
    this.getDeviceContext(accessory, device)

    // Set accessory information
    accessory
      .getService(this.hap.Service.AccessoryInformation)!
      .setCharacteristic(this.hap.Characteristic.Manufacturer, 'RainBird')
      .setCharacteristic(this.hap.Characteristic.AppMatchingIdentifier, 'id1060727082')
      .setCharacteristic(this.hap.Characteristic.Name, accessory.displayName)
      .setCharacteristic(this.hap.Characteristic.ConfiguredName, accessory.displayName)
      .setCharacteristic(this.hap.Characteristic.Model, accessory.context.model ?? rainbird!.model)
      .setCharacteristic(this.hap.Characteristic.SerialNumber, accessory.context.deviceID ?? rainbird!.serialNumber)
      .setCharacteristic(this.hap.Characteristic.FirmwareRevision, accessory.context.FirmwareRevision ?? rainbird!.version)
      .getCharacteristic(this.hap.Characteristic.FirmwareRevision)
      .updateValue(accessory.context.FirmwareRevision)
  }

  async getDeviceLogSettings(accessory: PlatformAccessory, device: DevicesConfig): Promise<void> {
    this.deviceLogging = this.platform.debugMode ? 'debugMode' : device.logging ?? this.config.logging ?? 'standard'
    const logging = this.platform.debugMode ? 'Debug Mode' : device.logging ? 'Device Config' : this.config.logging ? 'Platform Config' : 'Default'
    accessory.context.deviceLogging = this.deviceLogging
    await this.debugLog(`Using ${logging} Logging: ${this.deviceLogging}`)
  }

  async getDeviceRateSettings(accessory: PlatformAccessory, device: DevicesConfig): Promise<void> {
    // refreshRate
    this.deviceRefreshRate = device.refreshRate ?? this.config.options?.refreshRate ?? 1800
    accessory.context.deviceRefreshRate = this.deviceRefreshRate
    const refreshRate = device.refreshRate ? 'Device Config' : this.config.options?.refreshRate ? 'Platform Config' : 'Default'
    // updateRate
    this.deviceUpdateRate = device.updateRate ?? this.config.options?.updateRate ?? 5
    accessory.context.deviceUpdateRate = this.deviceUpdateRate
    const updateRate = device.updateRate ? 'Device Config' : this.config.options?.updateRate ? 'Platform Config' : 'Default'
    // pushRate
    this.devicePushRate = device.pushRate ?? this.config.options?.pushRate ?? 1
    accessory.context.devicePushRate = this.devicePushRate
    const pushRate = device.pushRate ? 'Device Config' : this.config.options?.pushRate ? 'Platform Config' : 'Default'
    await this.debugLog(`Using ${refreshRate} refreshRate: ${this.deviceRefreshRate}, ${updateRate} updateRate: ${this.deviceUpdateRate},`
    + ` ${pushRate} pushRate: ${this.devicePushRate}`)
  }

  async getDeviceConfigSettings(accessory: PlatformAccessory, device: DevicesConfig): Promise<void> {
    const deviceConfig = {}
    const properties = [
      'logging',
      'refreshRate',
      'updateRate',
      'pushRate',
      'external',
      'showRainSensor',
      'showValveSensor',
      'showProgramASwitch',
      'showProgramBSwitch',
      'showProgramCSwitch',
      'showProgramDSwitch',
      'showDelayIrrigationSwitch',
      'showStopIrrigationSwitch',
      'minValueRemainingDuration',
      'maxValueRemainingDuration',
      'syncTime',
      'showRequestResponse',
      'showZoneValve',
      'includeZones',
      'irrigationDelay',
    ]
    properties.forEach((prop) => {
      if (device[prop] !== undefined) {
        deviceConfig[prop] = device[prop]
      }
    })
    if (Object.keys(deviceConfig).length !== 0) {
      this.infoLog(`Config: ${JSON.stringify(deviceConfig)}`)
    }
    accessory.context.deviceConfig = deviceConfig
  }

  async getDeviceContext(accessory: PlatformAccessory, device: DevicesConfig): Promise<void> {
    accessory.context.FirmwareRevision = device.firmware ?? await this.platform.getVersion() ?? '3'
  }

  /**
   * Logging for Device
   */
  async infoLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      this.log.info(`${this.accessory.displayName}`, String(...log))
    }
  }

  async successLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      this.log.success(`${this.accessory.displayName}`, String(...log))
    }
  }

  async debugSuccessLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      if (await this.loggingIsDebug()) {
        this.log.success(`[DEBUG] ${this.accessory.displayName}`, String(...log))
      }
    }
  }

  async warnLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      this.log.warn(`${this.accessory.displayName}`, String(...log))
    }
  }

  async debugWarnLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      if (await this.loggingIsDebug()) {
        this.log.warn(`[DEBUG] ${this.accessory.displayName}`, String(...log))
      }
    }
  }

  async errorLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      this.log.error(`${this.accessory.displayName}`, String(...log))
    }
  }

  async debugErrorLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      if (await this.loggingIsDebug()) {
        this.log.error(`[DEBUG] ${this.accessory.displayName}`, String(...log))
      }
    }
  }

  async debugLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      if (this.deviceLogging === 'debug') {
        this.log.info(`[DEBUG] ${this.accessory.displayName}`, String(...log))
      } else if (this.deviceLogging === 'debugMode') {
        this.log.debug(`${this.accessory.displayName}`, String(...log))
      }
    }
  }

  async loggingIsDebug(): Promise<boolean> {
    return this.deviceLogging === 'debugMode' || this.deviceLogging === 'debug'
  }

  async enablingDeviceLogging(): Promise<boolean> {
    return this.deviceLogging === 'debugMode' || this.deviceLogging === 'debug' || this.deviceLogging === 'standard'
  }
}

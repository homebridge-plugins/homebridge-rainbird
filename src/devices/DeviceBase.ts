/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * DeviceBase.ts: @homebridge-plugins/homebridge-rainbird.
 */
import type { API, HAP, Logging, PlatformAccessory } from 'homebridge'
import type { RainBirdService } from 'rainbird'
import type { Subscription } from 'rxjs'

import type { RainbirdPlatform } from '../Platform.HAP.js'
import type { devicesConfig, RainbirdPlatformConfig } from '../settings.js'

const FIRMWARE_VERSION_STRIP_RE = /^V|-.*$/g
const FIRMWARE_VERSION_DOT_RE = /./g

export abstract class DeviceBase {
  /**
   * Everything this device subscribed to - controller status events and the
   * polling interval. Homebridge emits 'shutdown' so a plugin can stop its own
   * work; without this these kept firing at a controller while the bridge was
   * tearing down, and held the process open.
   */
  protected readonly subscriptions: Subscription[] = []

  /** Stop everything this device started. Called by the platform on shutdown. */
  public shutdown(): void {
    this.subscriptions.forEach(s => s.unsubscribe())
    this.subscriptions.length = 0
  }

  public readonly api: API
  public readonly log: Logging
  public readonly config!: RainbirdPlatformConfig
  protected readonly hap: HAP

  // Config
  protected deviceLogging!: string
  protected deviceRefreshRate!: number
  protected devicePushRate!: number
  protected deviceFirmwareVersion!: string

  constructor(
    protected readonly platform: RainbirdPlatform,
    protected accessory: PlatformAccessory,
    protected device: devicesConfig,
    protected rainbird: RainBirdService,
  ) {
    this.platform = platform
    this.api = this.platform.api
    this.log = this.platform.log
    this.config = this.platform.config
    this.hap = this.api.hap

    this.getDeviceLogSettings(device)
    this.getDeviceRateSettings(device)
    this.getDeviceConfigSettings(device)
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
      .setCharacteristic(this.hap.Characteristic.FirmwareRevision, this.deviceFirmwareVersion)
      .getCharacteristic(this.hap.Characteristic.FirmwareRevision)
      .updateValue(this.deviceFirmwareVersion)
  }

  async getDeviceLogSettings(device: devicesConfig): Promise<void> {
    this.deviceLogging = device.logging ?? this.platform.platformLogging ?? 'standard'
    const logging = device.logging ? 'Device Config' : this.platform.platformLogging ? 'Platform Config' : 'Default'
    await this.debugLog(`Using ${logging} Logging: ${this.deviceLogging}`)
  }

  async getDeviceRateSettings(device: devicesConfig): Promise<void> {
    // refreshRate
    // The defaults here match what the polling code actually used, so honouring
    // these settings changes nothing for anyone who has not set them
    this.deviceRefreshRate = device.refreshRate ?? this.platform.config.options?.refreshRate ?? this.platform.platformRefreshRate ?? 300
    const refreshRate = device.refreshRate ? 'Device Config' : this.platform.platformRefreshRate ? 'Platform Config' : 'Default'
    // pushRate. updateRate used to be parsed and echoed back here too, which made
    // it look accepted - nothing has ever read it, at either level.
    this.devicePushRate = device.pushRate ?? this.platform.config.options?.pushRate ?? this.platform.platformPushRate ?? 0.1
    const pushRate = device.pushRate ? 'Device Config' : this.platform.platformPushRate ? 'Platform Config' : 'Default'
    await this.debugLog(`Using ${refreshRate} refreshRate: ${this.deviceRefreshRate}, ${pushRate} pushRate: ${this.devicePushRate}`)
  }

  async getDeviceConfigSettings(device: devicesConfig): Promise<void> {
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
      this.debugSuccessLog(`Config: ${JSON.stringify(deviceConfig)}`)
    }
  }

  async getDeviceContext(accessory: PlatformAccessory, device: devicesConfig): Promise<void> {
    const deviceFirmwareVersion = device.firmware ?? this.rainbird.version ?? this.platform.version ?? '0.0.0'
    const version = deviceFirmwareVersion.toString()
    this.debugLog(`Firmware Version: ${version.replace(FIRMWARE_VERSION_STRIP_RE, '')}`)
    if (version?.includes('.') === false) {
      const replace = version?.replace(FIRMWARE_VERSION_STRIP_RE, '')
      const match = replace?.match(FIRMWARE_VERSION_DOT_RE)
      const validVersion = match?.join('.')
      this.deviceFirmwareVersion = validVersion ?? '0.0.0'
    } else {
      this.deviceFirmwareVersion = version.replace(FIRMWARE_VERSION_STRIP_RE, '') ?? '0.0.0'
    }
    accessory
      .getService(this.hap.Service.AccessoryInformation)!
      .setCharacteristic(this.hap.Characteristic.HardwareRevision, this.deviceFirmwareVersion)
      .setCharacteristic(this.hap.Characteristic.SoftwareRevision, this.deviceFirmwareVersion)
      .setCharacteristic(this.hap.Characteristic.FirmwareRevision, this.deviceFirmwareVersion)
      .getCharacteristic(this.hap.Characteristic.FirmwareRevision)
      .updateValue(this.deviceFirmwareVersion)
    this.debugSuccessLog(`deviceFirmwareVersion: ${this.deviceFirmwareVersion}`)
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

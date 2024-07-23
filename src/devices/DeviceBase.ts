/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * DeviceBase.ts: homebridge-rainbird.
 */
import type { RainBirdService } from 'rainbird';
import type { RainbirdPlatform } from '../platform.js';
import type { API, HAP, Logging, PlatformAccessory } from 'homebridge';
import type { RainbirdPlatformConfig, DevicesConfig } from '../settings.js';

export abstract class DeviceBase {
  public readonly api: API;
  public readonly log: Logging;
  public readonly config!: RainbirdPlatformConfig;
  protected readonly hap: HAP;

  // Config
  protected deviceLogging!: string;
  protected deviceRefreshRate!: number;

  constructor(
    protected readonly platform: RainbirdPlatform,
    protected accessory: PlatformAccessory,
    protected device: DevicesConfig,
    protected rainbird: RainBirdService,
  ) {
    this.api = this.platform.api;
    this.log = this.platform.log;
    this.config = this.platform.config;
    this.hap = this.api.hap;

    this.deviceLogs(device);
    this.getDeviceRefreshRate(device);
    this.deviceConfigOptions(device);
    this.deviceContext(accessory, device);

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
      .updateValue(accessory.context.FirmwareRevision);
  }

  async deviceLogs(device: DevicesConfig): Promise<void> {
    if (this.platform.debugMode) {
      this.deviceLogging = this.accessory.context.logging = 'debugMode';
      this.debugWarnLog(`Lock: ${this.accessory.displayName} Using Debug Mode Logging: ${this.deviceLogging}`);
    } else if (device.logging) {
      this.deviceLogging = this.accessory.context.logging = device.logging;
      this.debugWarnLog(`Lock: ${this.accessory.displayName} Using Device Config Logging: ${this.deviceLogging}`);
    } else if (this.config.logging) {
      this.deviceLogging = this.accessory.context.logging = this.config.logging;
      this.debugWarnLog(`Lock: ${this.accessory.displayName} Using Platform Config Logging: ${this.deviceLogging}`);
    } else {
      this.deviceLogging = this.accessory.context.logging = 'standard';
      this.debugWarnLog(`Lock: ${this.accessory.displayName} Logging Not Set, Using: ${this.deviceLogging}`);
    }
  }

  async getDeviceRefreshRate(device: DevicesConfig): Promise<void> {
    if (device.refreshRate) {
      if (device.refreshRate < 1800) {
        device.refreshRate = 1800;
        this.warnLog('Refresh Rate cannot be set to lower the 5 mins, as Lock detail (battery level, etc) are unlikely to change within that period');
      }
      this.deviceRefreshRate = this.accessory.context.refreshRate = device.refreshRate;
      this.debugLog(`Lock: ${this.accessory.displayName} Using Device Config refreshRate: ${this.deviceRefreshRate}`);
    } else if (this.config.refreshRate) {
      this.deviceRefreshRate = this.accessory.context.refreshRate = this.config.refreshRate;
      this.debugLog(`Lock: ${this.accessory.displayName} Using Platform Config refreshRate: ${this.deviceRefreshRate}`);
    }
  }

  async deviceConfigOptions(device: DevicesConfig): Promise<void> {
    const deviceConfig = {};
    if (device.logging !== undefined) {
      deviceConfig['logging'] = device.logging;
    }
    if (device.refreshRate !== undefined) {
      deviceConfig['refreshRate'] = device.refreshRate;
    }
    if (Object.entries(deviceConfig).length !== 0) {
      this.infoLog(`Lock: ${this.accessory.displayName} Config: ${JSON.stringify(deviceConfig)}`);
    }
  }

  async deviceContext(accessory: PlatformAccessory, device: DevicesConfig): Promise<void> {
    if (device.firmware) {
      accessory.context.FirmwareRevision = device.firmware;
    } else if (accessory.context.FirmwareRevision === undefined) {
      accessory.context.FirmwareRevision = await this.platform.getVersion();
    } else {
      accessory.context.FirmwareRevision = '3';
    }
  }

  /**
   * Logging for Device
   */
  async infoLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      this.log.info(`${this.accessory.displayName}`, String(...log));
    }
  }

  async successLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      this.log.success(`${this.accessory.displayName}`, String(...log));
    }
  }

  async debugSuccessLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      if (await this.loggingIsDebug()) {
        this.log.success(`[DEBUG] ${this.accessory.displayName}`, String(...log));
      }
    }
  }

  async warnLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      this.log.warn(`${this.accessory.displayName}`, String(...log));
    }
  }

  async debugWarnLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      if (await this.loggingIsDebug()) {
        this.log.warn(`[DEBUG] ${this.accessory.displayName}`, String(...log));
      }
    }
  }

  async errorLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      this.log.error(`${this.accessory.displayName}`, String(...log));
    }
  }

  async debugErrorLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      if (await this.loggingIsDebug()) {
        this.log.error(`[DEBUG] ${this.accessory.displayName}`, String(...log));
      }
    }
  }

  async debugLog(...log: any[]): Promise<void> {
    if (await this.enablingDeviceLogging()) {
      if (this.deviceLogging === 'debug') {
        this.log.info(`[DEBUG] ${this.accessory.displayName}`, String(...log));
      } else if (this.deviceLogging === 'debugMode') {
        this.log.debug(`${this.accessory.displayName}`, String(...log));
      }
    }
  }

  async loggingIsDebug(): Promise<boolean> {
    return this.deviceLogging === 'debugMode' || this.deviceLogging === 'debug';
  }

  async enablingDeviceLogging(): Promise<boolean> {
    return this.deviceLogging === 'debugMode' || this.deviceLogging === 'debug' || this.deviceLogging === 'standard';
  }
}
/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * DelayIrrigationSwitch.ts: homebridge-rainbird.
 */
import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge'
import type { RainBirdService } from 'rainbird'

import type { RainbirdPlatform } from '../platform.js'
import type { devicesConfig } from '../settings.js'

import { DeviceBase } from './DeviceBase.js'

export class DelayIrrigationSwitch extends DeviceBase {
  // Service
  private service: Service

  constructor(
    readonly platform: RainbirdPlatform,
    accessory: PlatformAccessory,
    device: devicesConfig,
    rainbird: RainBirdService,
  ) {
    super(platform, accessory, device, rainbird)

    // Delay Irrigation Switch Service
    this.debugLog(`Load Switch Service for ${accessory.displayName}`)
    this.service = this.accessory.getService(this.hap.Service.Switch) ?? this.accessory.addService(this.hap.Service.Switch)

    // Add Switch's Characteristics
    this.service
      .setCharacteristic(this.hap.Characteristic.On, false)
      .setCharacteristic(this.hap.Characteristic.Name, accessory.displayName)

    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(async () => {
        const state = await this.rainbird!.getIrrigationDelay() > 0
        this.debugLog(`${this.constructor.name}: ${this.accessory.displayName} On: ${state}`)
        return state
      })
      .onSet(async (value: CharacteristicValue) => {
        this.debugLog(`${this.constructor.name}: ${this.accessory.displayName}, Set On: ${value}`)
        if (value) {
          await this.rainbird!.setIrrigationDelay(this.device.irrigationDelay!)
        } else {
          await this.rainbird!.setIrrigationDelay(0)
        }
      })

    setInterval(async () => {
      await this.updateHomeKitCharacteristics()
    }, 3600000) // every hour
  }

  /**
   * Updates the status for each of the HomeKit Characteristics
   */
  private async updateHomeKitCharacteristics(): Promise<void> {
    const state = await this.rainbird!.getIrrigationDelay() > 0
    this.service.updateCharacteristic(this.hap.Characteristic.On, state)
    this.debugLog(`${this.constructor.name}: ${this.accessory.displayName} updateCharacteristic On: ${state}`)
  }
}

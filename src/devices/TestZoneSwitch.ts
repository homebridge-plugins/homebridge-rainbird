/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * TestZoneSwitch.ts: @homebridge-plugins/homebridge-rainbird.
 */
import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge'
import type { RainBirdService } from 'rainbird'

import type { RainbirdPlatform } from '../platform.js'
import type { devicesConfig } from '../settings.js'

import { DeviceBase } from './DeviceBase.js'

export class TestZoneSwitch extends DeviceBase {
  private testZoneSwitch!: {
    service: Service
    state: CharacteristicValue
  }

  constructor(
    readonly platform: RainbirdPlatform,
    accessory: PlatformAccessory,
    device: devicesConfig,
    rainbird: RainBirdService,
  ) {
    super(platform, accessory, device, rainbird)

    // Test Zone Switch Service
    this.debugLog(`Load Switch Service for ${accessory.displayName}`)
    this.testZoneSwitch = {
      service: this.accessory.getService(this.hap.Service.Switch) ?? this.accessory.addService(this.hap.Service.Switch),
      state: false,
    }

    // Add Switch's Characteristics
    this.testZoneSwitch.service
      .setCharacteristic(this.hap.Characteristic.On, false)
      .setCharacteristic(this.hap.Characteristic.Name, accessory.displayName)

    this.testZoneSwitch.service
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(() => {
        return this.testZoneSwitch.state
      })
      .onSet(this.setOn.bind(this))
  }

  private async setOn(value: CharacteristicValue) {
    this.debugLog(`${this.constructor.name}: ${this.accessory.displayName}, Set On: ${value}`)
    this.testZoneSwitch.state = value
    if (value) {
      try {
        await this.rainbird!.testZone(this.accessory.context.zoneId)
        this.debugLog(`${this.constructor.name}: ${this.accessory.displayName}, testZone(${this.accessory.context.zoneId}) completed`)
      } catch (e: any) {
        this.errorLog(`${this.constructor.name}: ${this.accessory.displayName}, testZone failed: ${e.message}`)
      }
      // Auto-turn off after test completes
      setTimeout(() => {
        this.testZoneSwitch.state = false
        this.testZoneSwitch.service.updateCharacteristic(this.hap.Characteristic.On, false)
        this.debugLog(`${this.constructor.name}: ${this.accessory.displayName}, Auto-off after test`)
      }, 500)
    }
  }
}

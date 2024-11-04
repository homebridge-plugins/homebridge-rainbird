/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * ContactSensor.ts: homebridge-rainbird.
 */
import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge'
import type { RainBirdService } from 'rainbird'

import type { RainbirdPlatform } from '../platform.js'
import type { devicesConfig } from '../settings.js'

import { fromEvent } from 'rxjs'

import { DeviceBase } from './DeviceBase.js'

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ContactSensor extends DeviceBase {
  // Service
  private contactSensor!: {
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

    // Contact Sensor Service
    this.debugLog(`Load Contact Sensor Service for ${accessory.displayName}`)
    this.contactSensor = {
      service: this.accessory.getService(this.hap.Service.ContactSensor) ?? this.accessory.addService(this.hap.Service.ContactSensor),
      state: this.hap.Characteristic.ContactSensorState.CONTACT_DETECTED,
    }

    // Add Contact Sensor's Characteristics
    this.contactSensor.service
      .setCharacteristic(this.hap.Characteristic.ContactSensorState, this.hap.Characteristic.ContactSensorState.CONTACT_DETECTED)
      .setCharacteristic(this.hap.Characteristic.Name, accessory.displayName)
      .setCharacteristic(this.hap.Characteristic.StatusFault, this.hap.Characteristic.StatusFault.NO_FAULT)

    this.contactSensor.service.getCharacteristic(this.hap.Characteristic.ContactSensorState).onGet(() => {
      this.rainbird!.refreshStatus()
      return this.contactSensor.state
    })

    // Initial Device Parse
    this.parseStatus()
    this.updateHomeKitCharacteristics()

    // Device Parse when status event emitted
    fromEvent(rainbird!, 'status').subscribe({
      next: () => {
        this.parseStatus()
        this.updateHomeKitCharacteristics()
      },
    })
  }

  /**
   * Parse the device status from the RainbirdClient
   */
  parseStatus() {
    this.contactSensor.state = this.rainbird!.isInUse(this.accessory.context.zoneId)
      ? this.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      : this.hap.Characteristic.ContactSensorState.CONTACT_DETECTED
    this.debugLog(`${this.constructor.name}: ${this.accessory.displayName}, ContactSensorState: ${this.contactSensor.state}`)
  }

  /**
   * Updates the status for each of the HomeKit Characteristics
   */
  async updateHomeKitCharacteristics() {
    // Valves
    if (this.contactSensor.state === undefined) {
      await this.debugLog(`${this.constructor.name} ${this.accessory.displayName} ContactSensorState: ${this.contactSensor.state}, ${this.accessory.context.zoneId}`)
    } else {
      this.contactSensor.service.updateCharacteristic(this.hap.Characteristic.ContactSensorState, this.contactSensor.state)
      await this.debugLog(`${this.constructor.name} ${this.accessory.displayName} ContactSensorState: ${this.contactSensor.state}, ${this.accessory.context.zoneId}`)
    }
  }
}

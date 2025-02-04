/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * ProgramSwitch.ts: @homebridge-plugins/homebridge-rainbird.
 */
import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge'
import type { RainBirdService } from 'rainbird'

import type { RainbirdPlatform } from '../platform.js'
import type { devicesConfig } from '../settings.js'

import { fromEvent } from 'rxjs'

import { DeviceBase } from './DeviceBase.js'

export class ProgramSwitch extends DeviceBase {
  private programSwitch!: {
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

    // Program Switch Service
    this.debugLog(`Load Switch Service for ${accessory.displayName}`)
    this.programSwitch = {
      service: this.accessory.getService(this.hap.Service.Switch) ?? this.accessory.addService(this.hap.Service.Switch),
      state: false,
    }

    // Add Contact Sensor's Characteristics
    this.programSwitch.service
      .setCharacteristic(this.hap.Characteristic.On, false)
      .setCharacteristic(this.hap.Characteristic.Name, accessory.displayName)

    this.programSwitch.service
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(() => {
        this.rainbird!.refreshStatus()
        return this.programSwitch.state
      })
      .onSet(this.setOn.bind(this))

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

  private async setOn(value: CharacteristicValue) {
    this.debugLog(`${this.constructor.name}: ${this.accessory.displayName}, Set On: ${value}`)
    this.programSwitch.state = value
    if (value) {
      await this.rainbird!.startProgram(this.accessory.context.programId)
    } else {
      await this.rainbird!.stopIrrigation()
    }
  }

  /**
   * Parse the device status from the RainbirdClient
   */
  parseStatus() {
    const isRunning = this.rainbird!.isProgramRunning(this.accessory.context.programId)
    if (isRunning !== undefined) {
      this.programSwitch.state = isRunning
    } else {
      if (this.programSwitch.state && !this.rainbird!.isInUse()) {
        this.programSwitch.state = false
      }
    }
    this.debugLog(`${this.constructor.name}: ${this.accessory.displayName} On: ${this.programSwitch.state}`)
  }

  /**
   * Updates the status for each of the HomeKit Characteristics
   */
  updateHomeKitCharacteristics() {
    if (this.programSwitch.state === undefined) {
      this.debugLog(`${this.constructor.name}: ${this.accessory.displayName} On: ${this.programSwitch.state}`)
    } else {
      this.programSwitch.service.updateCharacteristic(this.hap.Characteristic.On, this.programSwitch.state)
      this.debugLog(`${this.constructor.name}: ${this.accessory.displayName} updateCharacteristic On: ${this.programSwitch.state}`)
    }
  }
}

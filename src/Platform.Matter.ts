/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * Platform.Matter.ts: @homebridge-plugins/homebridge-rainbird.
 */
import type { RainBirdService } from 'rainbird'
import type { Subscription } from 'rxjs'

import type { devicesConfig } from './settings.js'

import { LogLevel } from 'rainbird'
import { fromEvent } from 'rxjs'

import { RainbirdPlatform } from './Platform.HAP.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'

/**
 * RainbirdMatterPlatform
 * Extends RainbirdPlatform to add Homebridge Matter support.
 * When Matter is available and enabled, devices are registered as Matter accessories
 * instead of HAP accessories.
 */
export class RainbirdMatterPlatform extends RainbirdPlatform {
  /** Map of Matter cached accessories restored from disk */
  public readonly matterAccessories: Map<string, any> = new Map()
  private readonly matterSubscriptions: Map<string, Subscription> = new Map()

  get matterApi(): any {
    return (this.api as any).matter
  }

  /**
   * Called when homebridge restores cached HAP accessories from disk.
   * Delegate to the HAP platform implementation so fallback to HAP mode
   * continues to use the restored cache without creating duplicates.
   */
  override configureAccessory(accessory: any): void {
    super.configureAccessory(accessory)
  }

  /**
   * Called when homebridge restores cached Matter accessories from disk at startup.
   */
  configureMatterAccessory(accessory: any): void {
    this.debugLog(`Loading cached Matter accessory: ${accessory.displayName}`)
    this.matterAccessories.set(accessory.UUID, accessory)
  }

  /**
   * Discover and register all RainBird devices as Matter accessories.
   * Overrides the HAP implementation to use the Matter API.
   */
  protected override async discoverDevices(): Promise<void> {
    if (!this.matterApi || typeof this.matterApi.registerPlatformAccessories !== 'function') {
      this.warnLog('Homebridge Matter API is not available. Falling back to HAP device registration.')
      return super.discoverDevices()
    }

    for (const device of this.config.devices!) {
      try {
        const { RainBirdService: RainBirdServiceCtor } = await import('rainbird')
        const rainbird = new RainBirdServiceCtor({
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

        // Display device details
        this.infoLog(`Matter Mode - Model: ${metaData.model}, [Version: ${metaData.version}, Serial Number: ${metaData.serialNumber}, Zones: ${JSON.stringify(metaData.zones)}]`)

        await this.registerMatterIrrigationSystem(device, rainbird)
        await this.registerMatterLeakSensor(device, rainbird)

        for (const zoneId of metaData.zones) {
          await this.registerMatterZoneValve(device, rainbird, zoneId)
          await this.registerMatterContactSensor(device, rainbird, zoneId)
          await this.registerMatterTestZoneSwitch(device, rainbird, zoneId, capabilities.supportsTestZone)
        }

        for (const programId of ['A', 'B', 'C', 'D']) {
          await this.registerMatterProgramSwitch(device, rainbird, programId)
        }

        await this.registerMatterStopIrrigationSwitch(device, rainbird)
        await this.registerMatterDelayIrrigationSwitch(device, rainbird)

        // Handle zone enable/disable
        rainbird.on('zone_enable', async (zoneId, enabled) => {
          if (enabled) {
            await this.registerMatterContactSensor(device, rainbird, zoneId)
            await this.registerMatterTestZoneSwitch(device, rainbird, zoneId, capabilities.supportsTestZone)
          } else {
            this.unregisterMatterAccessory(`${device.ipaddress}-${rainbird.model}-${zoneId}-contact-${rainbird.serialNumber}`)
            this.unregisterMatterAccessory(`${device.ipaddress}-${rainbird.model}-test-${zoneId}-${rainbird.serialNumber}`)
          }
        })
      } catch (e: any) {
        this.errorLog(`Failed to connect to RainBird controller at ${device.ipaddress}: ${e.message}`)
        this.errorLog(`Skipping device at ${device.ipaddress} and continuing with other devices...`)
        continue
      }
    }
  }

  /**
   * Register or update a Matter accessory. Always rebuilds the accessory definition
   * to apply config changes and re-attach handlers, merging into the cached instance if present.
   * When device.external is true the accessory is published as an external Matter accessory.
   */
  /**
   * Matter's BridgedDeviceBasicInformation.NodeLabel is constrained to 32 characters.
   * Homebridge sets the nodeLabel from the accessory displayName, so longer names make
   * the whole endpoint fail to register with "Behaviors have errors" (#587).
   */
  private clampMatterDisplayName(displayName: string): string {
    if (displayName.length <= 32) {
      return displayName
    }
    const clamped = displayName.slice(0, 32).trim()
    this.debugLog(`Display name "${displayName}" exceeds Matter's 32 character limit, using "${clamped}"`)
    return clamped
  }

  private async registerOrUpdateMatterAccessory(
    device: devicesConfig,
    uuidKey: string,
    buildAccessory: () => any,
  ): Promise<void> {
    const uuid = this.matterApi.uuid.generate(uuidKey)

    try {
      const freshDef = buildAccessory()
      freshDef.displayName = this.clampMatterDisplayName(freshDef.displayName)
      const existing = this.matterAccessories.get(uuid)

      if (existing) {
        // Always apply fresh config/handlers to cached instance so config changes and
        // handler re-attachment are not skipped on subsequent starts.
        existing.displayName = freshDef.displayName
        existing.clusters = freshDef.clusters
        existing.handlers = freshDef.handlers
        existing.firmwareRevision = freshDef.firmwareRevision
        if (typeof this.matterApi.updatePlatformAccessories === 'function') {
          await this.matterApi.updatePlatformAccessories([existing])
        }
        this.debugLog(`Updated cached Matter accessory: ${existing.displayName}`)
      } else {
        this.matterAccessories.set(uuid, freshDef)
        await this.externalOrPlatformMatter(device, freshDef)
        this.infoLog(`Registered Matter accessory: ${freshDef.displayName}`)
      }
    } catch (e: any) {
      this.errorLog(`Failed to register Matter accessory (key: ${uuidKey}): ${e.message}`)
    }
  }

  /**
   * Publish a Matter accessory as either an external accessory or a platform accessory,
   * mirroring the HAP externalOrPlatform behaviour.
   */
  private async externalOrPlatformMatter(device: devicesConfig, accessory: any): Promise<void> {
    if (device.external) {
      this.debugWarnLog(`${accessory.displayName} External Matter Accessory Mode`)
      if (typeof this.matterApi.publishExternalAccessories === 'function') {
        await this.matterApi.publishExternalAccessories(PLUGIN_NAME, [accessory])
      } else {
        this.warnLog(`${accessory.displayName} Matter API does not support publishExternalAccessories; registering as platform accessory`)
        await this.matterApi.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
      }
    } else {
      this.debugLog(`${accessory.displayName} Platform Matter Accessory Mode`)
      await this.matterApi.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
    }
  }

  /**
   * Ensure each Matter accessory has at most one event subscription attached.
   */
  private ensureMatterSubscription(uuidKey: string, createSubscription: () => Subscription): void {
    const uuid = this.matterApi.uuid.generate(uuidKey)
    if (this.matterSubscriptions.has(uuid)) {
      return
    }

    this.matterSubscriptions.set(uuid, createSubscription())
  }

  /**
   * Unregister a Matter accessory by UUID key.
   */
  private unregisterMatterAccessory(uuidKey: string): void {
    const uuid = this.matterApi.uuid.generate(uuidKey)
    const accessory = this.matterAccessories.get(uuid)
    const subscription = this.matterSubscriptions.get(uuid)
    subscription?.unsubscribe()
    this.matterSubscriptions.delete(uuid)

    if (accessory) {
      try {
        this.matterApi.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
        this.matterAccessories.delete(uuid)
        this.warnLog(`Removed Matter accessory: ${accessory.displayName}`)
      } catch (e: any) {
        this.errorLog(`Failed to unregister Matter accessory: ${accessory.displayName}: ${e.message}`)
      }
    }
  }

  /**
   * Update a Matter accessory cluster state safely.
   */
  private async updateMatterState(uuidKey: string, cluster: string, attributes: Record<string, unknown>): Promise<void> {
    try {
      const uuid = this.matterApi.uuid.generate(uuidKey)
      await this.matterApi.updateAccessoryState(uuid, cluster, attributes)
    } catch (e: any) {
      this.debugLog(`Matter state update failed (${cluster}): ${e.message}`)
    }
  }

  // ─── Irrigation System ───────────────────────────────────────────────────────

  private async registerMatterIrrigationSystem(device: devicesConfig, rainbird: RainBirdService): Promise<void> {
    if (device.hide_device) {
      return
    }

    const uuidKey = `${device.ipaddress}-${rainbird.model}-${rainbird.serialNumber}`
    const displayName = device.configDeviceName
      ? await this.validateAndCleanDisplayName(device.configDeviceName, 'configDeviceName', device.configDeviceName)
      : await this.validateAndCleanDisplayName(rainbird.model, 'model', rainbird.model)

    await this.registerOrUpdateMatterAccessory(device, uuidKey, () => ({
      UUID: this.matterApi.uuid.generate(uuidKey),
      displayName,
      deviceType: this.matterApi.deviceTypes.WaterValve,
      serialNumber: rainbird.serialNumber,
      manufacturer: 'RainBird',
      model: rainbird.model,
      firmwareRevision: rainbird.version ?? this.version,
      hardwareRevision: '1.0.0',
      clusters: {
        valveConfigurationAndControl: {
          currentState: rainbird.isInUse() ? 1 : 0,
          targetState: rainbird.isInUse() ? 1 : 0,
        },
      },
      handlers: {
        valveConfigurationAndControl: {
          open: async (request: any) => {
            const zones = rainbird.zones
            if (zones.length > 0) {
              rainbird.activateZone(zones[0], request?.openDuration ?? 300)
            }
          },
          close: async () => {
            await rainbird.stopIrrigation()
          },
        },
      },
      context: { deviceId: uuidKey },
    }))

    this.ensureMatterSubscription(uuidKey, () => fromEvent(rainbird, 'status').subscribe({
      next: async () => {
        await this.updateMatterState(uuidKey, 'valveConfigurationAndControl', {
          currentState: rainbird.isInUse() ? 1 : 0,
          targetState: rainbird.isInUse() ? 1 : 0,
        })
      },
    }))
  }

  // ─── Leak Sensor ─────────────────────────────────────────────────────────────

  private async registerMatterLeakSensor(device: devicesConfig, rainbird: RainBirdService): Promise<void> {
    if (device.hide_device || !device.showRainSensor) {
      return
    }

    const model = 'WR2'
    const uuidKey = `${device.ipaddress}-${model}-${rainbird.serialNumber}`
    const rawName = device.configDeviceName ? `${device.configDeviceName} Leak Sensor` : 'Leak Sensor'
    const displayName = await this.validateAndCleanDisplayName(rawName, 'configDeviceName Leak Sensor', rawName)

    await this.registerOrUpdateMatterAccessory(device, uuidKey, () => ({
      UUID: this.matterApi.uuid.generate(uuidKey),
      displayName,
      deviceType: this.matterApi.deviceTypes.LeakSensor,
      serialNumber: rainbird.serialNumber,
      manufacturer: 'RainBird',
      model,
      firmwareRevision: rainbird.version ?? this.version,
      hardwareRevision: '1.0.0',
      clusters: {
        booleanState: { stateValue: rainbird.rainSetPointReached },
      },
      context: { deviceId: uuidKey },
    }))

    this.ensureMatterSubscription(uuidKey, () => fromEvent(rainbird, 'rain_sensor_state').subscribe({
      next: async () => {
        await this.updateMatterState(uuidKey, 'booleanState', { stateValue: rainbird.rainSetPointReached })
      },
    }))
  }

  // ─── Zone Valve ──────────────────────────────────────────────────────────────

  private async registerMatterZoneValve(device: devicesConfig, rainbird: RainBirdService, zoneId: number): Promise<void> {
    const includeZones = device.includeZones!.split(',').map(Number)
    const shouldRegister = !device.hide_device
      && device.showZoneValve
      && (includeZones.includes(0) || includeZones.includes(zoneId))

    if (!shouldRegister) {
      return
    }

    const model = `${rainbird.model}-valve-${zoneId}`
    const uuidKey = `${device.ipaddress}-${model}-${rainbird.serialNumber}`
    const name = `Zone ${zoneId}`
    const rawName = device.configDeviceName ? `${device.configDeviceName} ${name}` : name
    const displayName = await this.validateAndCleanDisplayName(rawName, `configDeviceName ${name}`, rawName)
    const durationSeconds = 300

    await this.registerOrUpdateMatterAccessory(device, uuidKey, () => ({
      UUID: this.matterApi.uuid.generate(uuidKey),
      displayName,
      deviceType: this.matterApi.deviceTypes.WaterValve,
      serialNumber: rainbird.serialNumber,
      manufacturer: 'RainBird',
      model,
      firmwareRevision: rainbird.version ?? this.version,
      hardwareRevision: '1.0.0',
      clusters: {
        valveConfigurationAndControl: {
          currentState: rainbird.isActive(zoneId) ? 1 : 0,
          targetState: rainbird.isActive(zoneId) ? 1 : 0,
        },
      },
      handlers: {
        valveConfigurationAndControl: {
          open: async (request: any) => {
            rainbird.activateZone(zoneId, request?.openDuration ?? durationSeconds)
          },
          close: async () => {
            await rainbird.deactivateZone(zoneId)
          },
        },
      },
      context: { deviceId: uuidKey, zoneId },
    }))

    this.ensureMatterSubscription(uuidKey, () => fromEvent(rainbird, 'status').subscribe({
      next: async () => {
        await this.updateMatterState(uuidKey, 'valveConfigurationAndControl', {
          currentState: rainbird.isActive(zoneId) ? 1 : 0,
          targetState: rainbird.isActive(zoneId) ? 1 : 0,
        })
      },
    }))
  }

  // ─── Contact Sensor ──────────────────────────────────────────────────────────

  private async registerMatterContactSensor(device: devicesConfig, rainbird: RainBirdService, zoneId: number): Promise<void> {
    if (device.hide_device || !device.showValveSensor) {
      return
    }

    const model = `${rainbird.model}-${zoneId}`
    const uuidKey = `${device.ipaddress}-${model}-contact-${rainbird.serialNumber}`
    const name = `Zone ${zoneId}`
    const rawName = device.configDeviceName ? `${device.configDeviceName} ${name}` : name
    const displayName = await this.validateAndCleanDisplayName(rawName, `configDeviceName ${name}`, rawName)

    // Matter BooleanState: true = contact detected (zone NOT in use), false = contact not detected (zone in use)
    await this.registerOrUpdateMatterAccessory(device, uuidKey, () => ({
      UUID: this.matterApi.uuid.generate(uuidKey),
      displayName,
      deviceType: this.matterApi.deviceTypes.ContactSensor,
      serialNumber: rainbird.serialNumber,
      manufacturer: 'RainBird',
      model,
      firmwareRevision: rainbird.version ?? this.version,
      hardwareRevision: '1.0.0',
      clusters: {
        booleanState: { stateValue: !rainbird.isInUse(zoneId) },
      },
      context: { deviceId: uuidKey, zoneId },
    }))

    this.ensureMatterSubscription(uuidKey, () => fromEvent(rainbird, 'status').subscribe({
      next: async () => {
        await this.updateMatterState(uuidKey, 'booleanState', { stateValue: !rainbird.isInUse(zoneId) })
      },
    }))
  }

  // ─── Program Switch ──────────────────────────────────────────────────────────

  private async registerMatterProgramSwitch(device: devicesConfig, rainbird: RainBirdService, programId: string): Promise<void> {
    const showProgramSwitch = device[`showProgram${programId}Switch`]
    if (device.hide_device || !showProgramSwitch) {
      return
    }

    const model = `${rainbird.model}-pgm-${programId}`
    const uuidKey = `${device.ipaddress}-${model}-${rainbird.serialNumber}`
    const name = `Program ${programId}`
    const rawName = device.configDeviceName ? `${device.configDeviceName} ${name}` : name
    const displayName = await this.validateAndCleanDisplayName(rawName, `configDeviceName ${name}`, rawName)

    await this.registerOrUpdateMatterAccessory(device, uuidKey, () => ({
      UUID: this.matterApi.uuid.generate(uuidKey),
      displayName,
      deviceType: this.matterApi.deviceTypes.OnOffSwitch,
      serialNumber: rainbird.serialNumber,
      manufacturer: 'RainBird',
      model,
      firmwareRevision: rainbird.version ?? this.version,
      hardwareRevision: '1.0.0',
      clusters: {
        onOff: { onOff: rainbird.isProgramRunning(programId) ?? false },
      },
      handlers: {
        onOff: {
          on: async () => {
            await rainbird.startProgram(programId)
          },
          off: async () => {
            await rainbird.stopIrrigation()
          },
        },
      },
      context: { deviceId: uuidKey, programId },
    }))

    this.ensureMatterSubscription(uuidKey, () => fromEvent(rainbird, 'status').subscribe({
      next: async () => {
        const isRunning = rainbird.isProgramRunning(programId)
        if (isRunning !== undefined) {
          await this.updateMatterState(uuidKey, 'onOff', { onOff: isRunning })
        }
      },
    }))
  }

  // ─── Stop Irrigation Switch ──────────────────────────────────────────────────

  private async registerMatterStopIrrigationSwitch(device: devicesConfig, rainbird: RainBirdService): Promise<void> {
    if (device.hide_device || !device.showStopIrrigationSwitch) {
      return
    }

    const model = `${rainbird.model}-stop`
    const uuidKey = `${device.ipaddress}-${model}-${rainbird.serialNumber}`
    const rawName = device.configDeviceName ? `${device.configDeviceName} Stop Irrigation` : 'Stop Irrigation'
    const displayName = await this.validateAndCleanDisplayName(rawName, 'configDeviceName Stop Irrigation', rawName)

    await this.registerOrUpdateMatterAccessory(device, uuidKey, () => ({
      UUID: this.matterApi.uuid.generate(uuidKey),
      displayName,
      deviceType: this.matterApi.deviceTypes.OnOffSwitch,
      serialNumber: rainbird.serialNumber,
      manufacturer: 'RainBird',
      model,
      firmwareRevision: rainbird.version ?? this.version,
      hardwareRevision: '1.0.0',
      clusters: {
        onOff: { onOff: false },
      },
      handlers: {
        onOff: {
          on: async () => {
            rainbird.deactivateAllZones()
            await rainbird.stopIrrigation()
          },
          off: async () => {
            // No action needed for off
          },
        },
      },
      context: { deviceId: uuidKey },
    }))
  }

  // ─── Delay Irrigation Switch ─────────────────────────────────────────────────

  private async registerMatterDelayIrrigationSwitch(device: devicesConfig, rainbird: RainBirdService): Promise<void> {
    if (device.hide_device || !device.showDelayIrrigationSwitch) {
      return
    }

    const model = `${rainbird.model}-delay`
    const uuidKey = `${device.ipaddress}-${model}-${rainbird.serialNumber}`
    const rawName = device.configDeviceName ? `${device.configDeviceName} Delay Irrigation` : 'Delay Irrigation'
    const displayName = await this.validateAndCleanDisplayName(rawName, 'configDeviceName Delay Irrigation', rawName)
    const irrigationDelay = device.irrigationDelay ?? 1

    const initialDelay = await rainbird.getIrrigationDelay().catch((e: any) => {
      this.debugLog(`Failed to get irrigation delay for ${device.ipaddress}: ${e.message}`)
      return 0
    })

    await this.registerOrUpdateMatterAccessory(device, uuidKey, () => ({
      UUID: this.matterApi.uuid.generate(uuidKey),
      displayName,
      deviceType: this.matterApi.deviceTypes.OnOffSwitch,
      serialNumber: rainbird.serialNumber,
      manufacturer: 'RainBird',
      model,
      firmwareRevision: rainbird.version ?? this.version,
      hardwareRevision: '1.0.0',
      clusters: {
        onOff: { onOff: initialDelay > 0 },
      },
      handlers: {
        onOff: {
          on: async () => {
            await rainbird.setIrrigationDelay(irrigationDelay)
          },
          off: async () => {
            await rainbird.setIrrigationDelay(0)
          },
        },
      },
      context: { deviceId: uuidKey },
    }))
  }

  // ─── Test Zone Switch ────────────────────────────────────────────────────────

  private async registerMatterTestZoneSwitch(device: devicesConfig, rainbird: RainBirdService, zoneId: number, supportsTestZone: boolean): Promise<void> {
    if (device.hide_device || !device.showTestZoneSwitch) {
      return
    }

    if (!supportsTestZone) {
      this.warnLog(`Skipping Test Zone switch for zone ${zoneId} on ${rainbird.model}: controller does not support the testZone command`)
      return
    }

    const model = `${rainbird.model}-test-${zoneId}`
    const uuidKey = `${device.ipaddress}-${model}-${rainbird.serialNumber}`
    const name = `Zone ${zoneId} Test`
    const rawName = device.configDeviceName ? `${device.configDeviceName} ${name}` : name
    const displayName = await this.validateAndCleanDisplayName(rawName, `configDeviceName ${name}`, rawName)

    await this.registerOrUpdateMatterAccessory(device, uuidKey, () => ({
      UUID: this.matterApi.uuid.generate(uuidKey),
      displayName,
      deviceType: this.matterApi.deviceTypes.OnOffSwitch,
      serialNumber: rainbird.serialNumber,
      manufacturer: 'RainBird',
      model,
      firmwareRevision: rainbird.version ?? this.version,
      hardwareRevision: '1.0.0',
      clusters: {
        onOff: { onOff: false },
      },
      handlers: {
        onOff: {
          on: async () => {
            try {
              await rainbird.testZone(zoneId)
            } catch (e: any) {
              this.errorLog(`testZone(${zoneId}) failed: ${e.message}`)
            }
            // Auto-turn off after test completes
            setTimeout(async () => {
              await this.updateMatterState(uuidKey, 'onOff', { onOff: false })
            }, 500)
          },
          off: async () => {
            // No action needed for off
          },
        },
      },
      context: { deviceId: uuidKey, zoneId },
    }))
  }
}

/**
 * A controller that moves to a new IP address (#613).
 *
 * Each accessory's id is made from the controller's IP address, model and
 * serial number. A new address therefore gave a new id, so the cached accessory
 * was not found, a second copy was added to the Home app without its rooms or
 * automations, and the old one was left behind. The cached accessory with the
 * same serial number and model should be used instead.
 */
import { describe, expect, it, vi } from 'vitest'

import { RainbirdPlatform } from './Platform.HAP.js'

vi.mock('./devices/IrrigationSystem.js', () => ({
  IrrigationSystem: class {},
}))

const serialNumber = '4231acd58a5a00'
const model = 'ESP-Me'
const uuidFor = (ip: string, name: string) => `${ip}-${name}-${serialNumber}`

function makePlatform(cached: any[]) {
  const host: any = Object.create(RainbirdPlatform.prototype)
  host.accessories = [...cached]
  host.api = {
    hap: {
      uuid: {
        generate: (seed: string) => seed,
      },
    },
    updatePlatformAccessories: vi.fn(),
  }
  host.infoLog = vi.fn()
  host.debugLog = vi.fn()
  host.errorLog = vi.fn()
  host.platformLogging = 'standard'
  host.validateAndCleanDisplayName = vi.fn(async (name: string) => name)
  host.FirmwareRevision = vi.fn(async () => '2.9')
  host.registerHandler = vi.fn()
  host.externalOrPlatform = vi.fn()
  host.createPlatformAccessory = vi.fn((name: string, uuid: string) => ({ UUID: uuid, displayName: name, context: {} }))
  host.unregisterPlatformAccessories = vi.fn()
  return host
}

function cachedAccessory(ip: string) {
  return {
    UUID: uuidFor(ip, model),
    displayName: model,
    context: {
      deviceID: serialNumber,
      model,
      device: { ipaddress: ip },
    },
  }
}

const rainbird: any = { model, serialNumber }

describe('a controller that moved to a new ip address (#613)', () => {
  it('keeps using the cached accessory instead of adding a second copy', async () => {
    const old = cachedAccessory('192.168.1.20')
    const platform = makePlatform([old])

    const result = await platform.createIrrigationSystem({ ipaddress: '10.0.0.5' }, rainbird)

    expect(result).toBe(old)
    expect(platform.createPlatformAccessory).not.toHaveBeenCalled()
    expect(old.context.device.ipaddress).toBe('10.0.0.5')
  })

  it('prefers an accessory whose id matches exactly', async () => {
    const old = cachedAccessory('192.168.1.20')
    const current = cachedAccessory('10.0.0.5')
    const platform = makePlatform([old, current])

    const result = await platform.createIrrigationSystem({ ipaddress: '10.0.0.5' }, rainbird)

    expect(result).toBe(current)
  })

  it('does not take an accessory belonging to a different controller', () => {
    const other = {
      ...cachedAccessory('192.168.1.20'),
      context: { deviceID: 'another-serial', model },
    }
    const platform = makePlatform([other])

    expect(platform.findCachedAccessory(uuidFor('10.0.0.5', model), serialNumber, model)).toBeUndefined()
  })

  it('removes a hidden zone even when it was cached under the old address', () => {
    const zone = {
      UUID: uuidFor('192.168.1.20', `${model}-valve-3`),
      displayName: 'Zone 3',
      context: { deviceID: serialNumber, model: `${model}-valve-3` },
    }
    const platform = makePlatform([zone])

    platform.removeZoneValve({ ipaddress: '10.0.0.5' }, rainbird, 3)

    expect(platform.unregisterPlatformAccessories).toHaveBeenCalledWith(zone)
    expect(platform.accessories).toHaveLength(0)
  })
})

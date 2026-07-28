import type { PlatformConfig } from 'homebridge'

import { describe, expect, it } from 'vitest'

import { createPlatformProxy } from './utils.js'

/**
 * The proxy decides, at construction, whether this install runs over Matter or
 * HAP. Getting it wrong is not a subtle bug - the plugin either publishes
 * everything twice or not at all - and the decision depends on four inputs that
 * interact, so it is worth pinning down every combination.
 */

class FakeHAPPlatform {
  public readonly kind = 'hap'
  constructor(public log: any, public config: PlatformConfig, public api: any) {}
}

class FakeMatterPlatform {
  public readonly kind = 'matter'
  constructor(public log: any, public config: PlatformConfig, public api: any) {}
}

function build(config: Partial<PlatformConfig>, api: any) {
  const Proxy = createPlatformProxy(FakeHAPPlatform, FakeMatterPlatform)
  return new Proxy({}, config as PlatformConfig, api)
}

const matterReady = { isMatterAvailable: () => true, isMatterEnabled: () => true }
const matterOff = { isMatterAvailable: () => true, isMatterEnabled: () => false }
const noMatter = { isMatterAvailable: () => false, isMatterEnabled: () => false }

describe('createPlatformProxy', () => {
  it('uses matter when it is available and nothing opts out', () => {
    // Both options default to true, so an unconfigured install on a
    // Matter-capable Homebridge should land on Matter.
    expect(build({}, matterReady).kind).toBe('matter')
  })

  it('falls back to hap when homebridge cannot offer matter', () => {
    expect(build({}, noMatter).kind).toBe('hap')
  })

  it('falls back to hap when matter is available but switched off in homebridge', () => {
    // isMatterAvailable() alone is not enough - the user must also have
    // enabled Matter in Homebridge's own settings.
    expect(build({}, matterOff).kind).toBe('hap')
  })

  it('honours enableMatter: false even on a matter-ready setup', () => {
    expect(build({ options: { enableMatter: false } } as any, matterReady).kind).toBe('hap')
  })

  it('honours preferMatter: false even on a matter-ready setup', () => {
    expect(build({ options: { preferMatter: false } } as any, matterReady).kind).toBe('hap')
  })

  it('treats a missing api as hap rather than throwing', () => {
    // A Homebridge version without the Matter API has no isMatterAvailable at
    // all. Optional chaining must absorb that, not crash on startup.
    expect(build({}, {}).kind).toBe('hap')
    expect(build({}, undefined).kind).toBe('hap')
  })

  it('passes log, config and api straight through to the chosen platform', () => {
    const Proxy = createPlatformProxy(FakeHAPPlatform, FakeMatterPlatform)
    const log = { info: () => {} }
    const config = { platform: 'RainBird' } as PlatformConfig
    const impl = new Proxy(log, config, noMatter)

    expect(impl.log).toBe(log)
    expect(impl.config).toBe(config)
    expect(impl.api).toBe(noMatter)
  })

  it('falls back to hap when no matter platform was supplied', () => {
    const Proxy = createPlatformProxy(FakeHAPPlatform, undefined)
    expect(new Proxy({}, {} as PlatformConfig, matterReady).kind).toBe('hap')
  })
})

/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * utils.ts: @homebridge-plugins/homebridge-rainbird.
 */
import type { PlatformConfig } from 'homebridge'

/**
 * Creates a proxy class that instantiates the correct platform implementation
 * (HAP or Matter) at runtime based on availability and user configuration.
 *
 * @param HAPPlatform The HAP platform class constructor.
 * @param MatterPlatform The Matter platform class constructor.
 * @returns A proxy class that delegates to the correct platform implementation.
 */
export function createPlatformProxy(HAPPlatform: any, MatterPlatform: any): any {
  return class RainbirdPlatformProxy {
    /** The instantiated platform implementation (HAP or Matter) */
    private impl: any

    constructor(log: any, config: PlatformConfig, api: any) {
      const preferMatter: boolean = config?.options?.preferMatter ?? true
      const enableMatter: boolean = config?.options?.enableMatter ?? true
      const matterAvailable = !!(api?.isMatterAvailable?.() && api?.isMatterEnabled?.())

      if (enableMatter && preferMatter && MatterPlatform && matterAvailable) {
        this.impl = new MatterPlatform(log, config, api)
        return this.impl
      }

      // Fallback to HAP
      this.impl = new HAPPlatform(log, config, api)
      return this.impl
    }
  }
}

/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * index.ts: @homebridge-plugins/homebridge-rainbird.
 */
import type { API } from 'homebridge'

import { RainbirdPlatform } from './Platform.HAP.js'
import { RainbirdMatterPlatform } from './Platform.Matter.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'
import { createPlatformProxy } from './utils.js'

// Register our platform with homebridge.
export default (api: API): void => {
  const ProxyCtor = createPlatformProxy(RainbirdPlatform, RainbirdMatterPlatform)
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, ProxyCtor as any)
}

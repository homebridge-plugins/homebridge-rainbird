/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker) & mantorok1 (https://github.com/mantorok1). All rights reserved.
 *
 * index.ts: @homebridge-plugins/homebridge-rainbird.
 */
import type { API } from 'homebridge'

import { RainbirdPlatform } from './platform.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'

// The rainbird package bundles undici 8.x, which sets a legacy compatibility symbol
// (Symbol.for('undici.globalDispatcher.1')) on globalThis at import time.  Other
// Homebridge plugins that bundle their own undici 7.x check whether that symbol is
// already set; if it is they skip creating their own dispatcher and end up using the
// undici 8.x agent instead – which enables HTTP/2 Extended CONNECT and breaks e.g.
// the Ring plugin's WebSocket connections.
//
// undici 8.x uses Symbol.for('undici.globalDispatcher.2') for its own requests, so
// clearing the legacy .1 slot here does not affect RainBird's HTTP communication.
// Plugins that need their own undici 7.x dispatcher will simply initialise a fresh
// one when they load, which is the correct behaviour.
;(globalThis as Record<symbol, unknown>)[Symbol.for('undici.globalDispatcher.1')] = undefined

// Register our platform with homebridge.
export default (api: API): void => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, RainbirdPlatform)
}

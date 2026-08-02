<p align="center">
   <a href="https://github.com/homebridge-plugins/homebridge-rainbird"><img alt="homebridge-rainbird" src="https://raw.githubusercontent.com/homebridge-plugins/homebridge-rainbird/latest/branding/Homebridge_x_Rainbird.png" width="600px"></a>
</p>
<span align="center">

## homebridge-rainbird

Homebridge plugin to integrate RainBird irrigation controllers into HomeKit

[![npm](https://img.shields.io/npm/v/@homebridge-plugins/homebridge-rainbird/latest?label=latest)](https://www.npmjs.com/package/@homebridge-plugins/homebridge-rainbird)
[![npm](https://img.shields.io/npm/v/@homebridge-plugins/homebridge-rainbird/beta?label=beta)](https://github.com/homebridge/homebridge/wiki/How-to-Install-Alternate-Plugin-Versions)<br>
[![verified-by-homebridge](https://img.shields.io/badge/homebridge-verified-blueviolet?color=%23491F59&style=flat)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)<br>
[![npm](https://img.shields.io/npm/dt/@homebridge-plugins/homebridge-rainbird)](https://www.npmjs.com/package/@homebridge-plugins/homebridge-rainbird)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=hb-discord)](https://discord.gg/bHjKNkN)

</span>

### Plugin Information

- This plugin allows you to view and control your [RainBird](https://www.rainbird.com) irrigation controller within HomeKit. The plugin:
  - communicates with your controller locally over your network (no cloud required)
  - requires your controller's IP address and password
  - exposes your zones as a HomeKit irrigation system, with optional program switches, zone valves, delay and stop switches, and rain sensors

### Prerequisites

- To use this plugin, you will need to already have:
  - [Node](https://nodejs.org): latest version of `v22`, `v24` or `v26` - any other major version is not supported.
  - [Homebridge](https://homebridge.io): `v2` - refer to link for more information and installation instructions.

### Setup

- [Installation](https://github.com/homebridge-plugins/homebridge-rainbird/wiki/Installation)
- [Configuration](https://github.com/homebridge-plugins/homebridge-rainbird/wiki/Configuration)
- [Beta Version](https://github.com/homebridge-plugins/homebridge-rainbird/wiki/Beta-Version)
- [Node Version](https://github.com/homebridge-plugins/homebridge-rainbird/wiki/Node-Version)

### Supported Controllers

- Any controller that supports the [RainBird LNK WiFi Module](https://www.rainbird.com/products/lnk-wifi-module) should be compatible, including:
  - ESP-Me
  - ESP-TM2
  - ESP-RZXe
  - ESP-ME3

### Known Limitations

- The Home app defaults all sprinkler zone names to the irrigation system's name, so it's not obvious which zone is which. The first one in the list may not necessarily be Zone 1 - rename them once you've worked out which is which.
- Using the RainBird app while the plugin is running can cause connectivity issues.
- The RainBird LNK WiFi Module may not support "Band Steering" or WiFi channel 13 - avoid these on your router if you have connectivity issues.
- Some models do not support displaying the time remaining. If it's not working for your model, please open a GitHub issue and we will try to add it with your help.

### Help/About

- [Common Errors](https://github.com/homebridge-plugins/homebridge-rainbird/wiki/Common-Errors)
- [Support Request](https://github.com/homebridge-plugins/homebridge-rainbird/issues/new/choose)
- [Changelog](https://github.com/homebridge-plugins/homebridge-rainbird/blob/latest/CHANGELOG.md)

### Credits

- To [@donavanbecker](https://github.com/donavanbecker): the original creator and maintainer of this plugin.
- To [@mantorok1](https://github.com/mantorok1): the main developer of the [RainBird API library](https://github.com/donavanbecker/rainbird) this plugin uses.
- To the creators/contributors of [Homebridge](https://homebridge.io) who make this plugin possible.

### Disclaimer

- I am in no way affiliated with RainBird and this plugin is a personal project that I maintain in my free time.
- Use this plugin entirely at your own risk - please see licence for more information.

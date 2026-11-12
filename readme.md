# GeoFS-V4.0_Overpowered-Engines

Experimental V4 port of the GeoFS V3.9 Overpowered Engines userscript. Version 0.1.0 is unstable and its physics integration still needs testing in the GeoFS V4 beta.

## Features

- Open the original controls using **OP ENGINES** on the GeoFS autopilot bar.
- Adjust the thrust multiplier and altitude ceiling, toggle stability augmentation, and configure the thrust hotkey.
- Coordinate thrust and ceiling controls with the V4 Autothrottle when it is installed.
- Restore saved engine values when controls are switched off.

## Installation

Install a userscript manager and install the script from [Greasy Fork](https://greasyfork.org/en/scripts/604894-geofs-v4-0-overpowered-engines). The manager loads the V4 Core Library and Design System automatically. Open or reload GeoFS V4; this script does not run on V3.9.

## Testing

The port has automated checks with simulated aircraft data. Real aircraft behavior, high-altitude flight, stability augmentation, and Autothrottle coordination need verification in the GeoFS V4 beta.

With Node.js and jsdom available, run `node port.test.js` from this directory.

## Educational And Fair-Play Disclaimer

> [!CAUTION]
> This code is provided for educational, research, and testing purposes in authorized environments. Automated assistance or scripts that violate platform terms may lead to account penalties. The developers and contributors accept no responsibility for misuse.

## License

[MIT](license) · © 2026 AMFI-Disable

## Latest Experimental Update

Updates V4 integration and expands the port checks. This version targets GeoFS V4; in-simulator validation is pending.

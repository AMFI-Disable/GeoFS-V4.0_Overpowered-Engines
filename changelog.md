# Changelog

## [0.1.0] - Experimental V4 Port

### Added

- Port the V3.9 autopilot-bar button and controls to the V4 shared initialization framework.
- Connect V4 Autothrottle events and apply its live multiplier updates.
- Reset cached physics data when the aircraft instance changes and preserve zero-valued engine parameters during restoration.

### Testing

- Simulator physics compatibility and flight behavior still require testing in GeoFS V4 beta.

# node-red-contrib-axis-camera
An Axis Camera administration node that simplifies the most common VAPIX and SOAP/ONVIF API requests including
* Get camera info
* Get JPEG image snapshot
* Get/Set properties
* List/Set/Remove user accounts
* Manage MQTT client including event publishing
* List/Start/Stop/Install/Remove ACAP
* Restart device
* List/Create Certificates & Signing requests
* List device connections
* Enable remote syslog server
* Update Firmware

## Changelog

### Version 1.5.2
* Firmware and ACAP installation is now working as expected
* Added examples flows
* Refactoring due to replacing dependency from request to got

### Version 1.3.2
* Fixed a bug in action MQTT Connect that prevented CA certificate validation.
* Fixed a bug in MQTT Client where property connected was always false while connected.

### Version 1.3.1
* Fixed a bug that could result in a crash when requesting Info
* Added more information in Info including device type, audio support and supported resolutions.

### Version 1.3.0
* Fixed a bug in action Info that could crash Node-Red
* Action ACAP list will now respond with an array and not an object if only one ACAP is installed.

### Version 1.2.2
* Added action 'Info' that responds with common needed properties of the camera
* Added support for managing the built-in MQTT client.  Requires Axis firmware >= 9.80

### Version 1.0.1
* Fixed HTTP POST flaw

### Version 1.0.0
* Fixed response on Get Property when authentication failed
* Added HTTP POST



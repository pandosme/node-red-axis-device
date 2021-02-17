const fs = require("fs");
const AxisDigest = require("./AxisDigest.js");
const AxisParser = require("./AxisParser.js");

var exports = module.exports = {};

exports.JPEG = function( device, profile, callback ) {
	console.log("Imge capture: " + profile);
	AxisDigest.get( device, '/axis-cgi/jpg/image.cgi?' + profile, "buffer", function( error, body ) {
		callback( error, body );
	});
}

exports.Get = function( device, cgi, responseType, callback ) {
	AxisDigest.get( device, cgi, responseType, function( error, body ) {
		callback( error, body );
	});
}

exports.Post = function( device, cgi, payload, callback ) {
	AxisDigest.post( device, cgi, payload, function( error, body ) {
		callback( error, body );
	});
}

exports.GetParam = function( device, paramPath, callback ) {
	if( !paramPath || paramPath.length === 0 || paramPath.toLowerCase ( ) === "root" ) {
		callback(true,"Invalid parameter path.  Set data to a valid parameter group" );
		return;
	}
	AxisDigest.get( device, '/axis-cgi/param.cgi?action=list&group=' + paramPath, "text", function( error, body ) {
		if( error ) {
			callback( error, "Unable to request " + paramPath );
			return;
		}
		if( body.search("Error") >= 0 ) {
			callback( true, body);
			return;
		}
		var params = AxisParser.param2json(body);
		callback( false, params );
	});
}

exports.SetParam = function( device, group, parameters, callback ) {
//	console.log("SetParam",device,group,parameters);
	if( !group || group.length == 0 ) {
		callback( true, "Undefined property group");
		return;
	}

	if( !parameters || !(typeof parameters === 'object') ) {
		callback( true, "Input is not a valid object");
		return;
	}
	var path = '/axis-cgi/param.cgi?action=update';
	for( var parameter in parameters ) {
		var value = parameters[parameter];
		if( value === true )
			value = 'yes';
		if( value === false )
			value = 'no'
		if(  typeof parameters[parameter] === 'object' ) {
			//Don't update sub groups 
		} else {
			path += '&root.' + group + '.' + parameter + '=' + encodeURIComponent(value);
		}
	}
	
	AxisDigest.get( device, path, "text", function( error, body ) {
		if( error ) {
			callback( error, "Unable to set parameters" );
			return;
		}
		if( body.search("Error") >= 0 ) {
			callback( true, body);
			return;
		}
		callback( false, body );
	});
}

exports.DeviceInfo = function( device, callback ) {
//	console.log("DeviceInfo",device);
	var info = {
		type: "Undefined",
		model: "Undefined",
		serial: "Undefined",
		IPv4: "Undefined",
		IPv6: "Undefined",
		hostname: "Undefined",
		platform: "Undefined",
		chipset: "Undefined",
		firmware: "Undefined",
		hardware: "Undefined",
		camera: null,
		audio: null
	};

	//Brand
	exports.GetParam( device, "brand", function( error, response ) {
		if( error ) {
			callback( error,"Unable to read get brand data" );
			return;
		}

		if( response.hasOwnProperty("ProdNbr") )
			info.model = response.ProdNbr;
		if( response.hasOwnProperty("ProdType") )
			info.type = response.ProdType;

		exports.GetParam( device, "network", function( error, response ) {
			if( error ) {
				callback( error,"Unable to read network settings" );
				return;
			}
			if( response.hasOwnProperty("HostName") )
				info.hostname = response.HostName;
			if( response.hasOwnProperty("VolatileHostName") )
				info.hostname = response.VolatileHostName.HostName;
			if( response.hasOwnProperty("eth0") ) {
				if( response.eth0.hasOwnProperty("IPAddress") )
					info.IPv4 = response.eth0.IPAddress;
				if( response.eth0.hasOwnProperty("IPv6") && response.eth0.IPv6.hasOwnProperty("IPAddresses") )
					info.IPv6 = response.eth0.IPv6.IPAddresses;
				if( response.eth0.hasOwnProperty("MACAddress") )
					info.mac = response.eth0.MACAddress;

				exports.GetParam( device, "properties", function( error, response ) {
					if( error ) {
						callback( error,"Unable to read properties" );
						return;
					}
//					console.log(response);
					if( response.hasOwnProperty("Firmware") && response.Firmware.hasOwnProperty("Version"))
						info.firmware = response.Firmware.Version;
					if( response.hasOwnProperty("Image") && response.Image.hasOwnProperty("Format")) {
						info.camera = {
							formats: response.Image.Format.split(","),
							resolutions: response.Image.Resolution.split(",")
						}
					}
					if( response.hasOwnProperty("Audio") && response.Audio.hasOwnProperty("Audio")) {
						info.audio = response.Audio.Audio;
					}
					if( response.hasOwnProperty("System") ) {
						if(  response.System.hasOwnProperty("SerialNumber") )
							info.serial = response.System.SerialNumber;
						if( response.System.hasOwnProperty("Architecture") )
							info.platform = response.System.Architecture;
						if( response.System.hasOwnProperty("Soc") ) {
							var items = response.System.Soc.split(' ');
							if( items.length > 1 )
								info.chipset = items[1];
							else
								info.chipset = response.System.Soc;
						}
						if( response.System.hasOwnProperty("HardwareID") )
							info.hardware = response.System.HardwareID;
					}

					if( info.camera ) {
						exports.GetParam( device, "ImageSource.I0", function( error, response ) {
							if( error ) {
								callback( error,"Unable to read sensor properties" );
								return;
							}
							info.camera.aspect = "4:3";
							info.camera.largest = info.camera.resolutions[0];
							info.camera.medium = "640x480";
							info.camera.smallest = info.camera.resolutions[ info.camera.resolutions.length-1 ];
							info.camera.rotation = 0;
							if( response && response.hasOwnProperty("I0") ) { 
								if( response.I0.hasOwnProperty("Sensor") && response.I0.Sensor.hasOwnProperty("AspectRatio") ) {
									info.camera.aspect  = response.I0.Sensor.AspectRatio;
									if( info.camera.aspect === "16:9")
										info.camera.medium = "640x360";
									if( info.camera.aspect === "4:3")
										info.camera.medium = "640x480";
									if( info.camera.aspect === "1:1")
										info.camera.medium = "640x640";
									if( info.camera.aspect === "16:10")
										info.camera.medium = "640x400";
								}
								if( response.I0.hasOwnProperty("Rotation") )
									info.camera.rotation = parseInt(response.I0.Rotation);
							}
							callback(false,info);
						});
					} else {
						callback(false,info);
					}
				});
			}
		});
	});
}


// payload may be a filepath or a file buffer
exports.UpdateFirmware = function( device , payload, callback ) {
	var fileBuffer = payload;
	
	if( Buffer.isBuffer(payload)  ) {
		AxisDigest.upload( device, "firmware", "firmware.bin", payload, function( error, response) {
			callback( error, response );
		});
		return;
	}
	
	if( typeof payload !== "string" ) {
		callback("Invalid input","Firmware upload requires a filepath or buffer");
		return;
	}
	if( !fs.existsSync(payload) ) {
		callback("Invalid input","File "+ payload + " does not exist");
		return;
	}	

	AxisDigest.upload( device, "firmware", "firmware.bin", fs.createReadStream(payload), function( error, response) {
		callback( error, response );
	});
}

exports.Reboot = function( device, callback ) {
	AxisDigest.get( device, '/axis-cgi/restart.cgi', "text", function(error, response) {
		if( error ) {
			callback( error, response );
			return;
		}
		callback( false, "Device restarting" );
	});
}


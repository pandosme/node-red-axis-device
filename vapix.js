const fs = require("fs");
const AxisDigest = require("./AxisDigest.js");
const AxisParser = require("./AxisParser.js");

var exports = module.exports = {};

exports.JPEG = function( device, profile, callback ) {
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

exports.Reboot = function( device, callback ) {
	AxisDigest.get( device, '/axis-cgi/restart.cgi', "text", function(error, response) {
		if( error ) {
			callback( error, response );
			return;
		}
		callback( false, "Device restarting" );
	});
}

exports.ACAP_List = function( device, callback ) {
	AxisDigest.get( device, '/axis-cgi/applications/list.cgi', "text", function(error, response) {
		if( error ) {
			callback( true, response );
			return;
		}
		if( response.search("Error") >= 0 ) {
			callback( true, response );
			return;
		}
		AxisParser.AcapList2JSON(response, function(error, data) {
			callback( true, data );
		});
	});
}

exports.ACAP_Control = function( device, action, acapID, callback ) {
	//Actions:  "start", "stop", "remove"
	if( !action || action.length == 0 ) {
		callback( true, "Invalid ACAP control action");
		return;
	}
	
	if( !acapID || acapID.length == 0 || acapID.length > 20 ) {
		callback( true, "Invalid ACAP ID");
		return;
	}
	
	var path =  '/axis-cgi/applications/control.cgi?action=' + action + '&package=' + acapID;
	AxisDigest.get( device, path, "text", function(error, response) {
		if( error ) {
			callback( true, response );
			return;
		}
		response = response.trim();
		switch( response ) {
			case "OK":
			case "Error: 6":  //Application is already running
			case "Error: 7":  //Application is not running
				callback( false, "OK");
			break;
			case "Error: 4":
				callback( true, "Invalid ACAP");
			break;
			default:
				callback( true, response );
			break;
		}
	});
}

exports.Account_Remove = function( device, accountName, callback ) {
	var path  = "/axis-cgi/pwdgrp.cgi?action=remove&user=" + accountName;
	exports.get( device, path, function( error, response ) {
		if( error ) {
			callback(true, response );
			return;
		}
		if( response.search("Error") >= 0 ) {
			callback( true, "Unable to remove account");
			return;
		}
		callback(false,"OK");
	});
}

exports.Upload_Firmare = function( device , options, callback ) {
	
	if( Buffer.isBuffer(options)  ) {
		AxisDigest.upload( device, "firmware", "firmware.bin", options, function( error, response) {
			callback( error, response );
		});
		return;
	}
	
	if( typeof options !== "string" ) {
		callback("Invalid input","Firmware upload requires a filepath or buffer");
		return;
	}
	if( !fs.existsSync(options) ) {
		callback("Invalid input","File "+ options + " does not exist");
		return;
	}	

	AxisDigest.upload( device, "firmware", "firmware.bin", null, fs.createReadStream(options), function( error, response) {
		callback( error, response );
	});
}

exports.Upload_Overlay = function( device, filename, options, callback ) {
	if(!filename || typeof filename !== "string" ) {
		callback(true,"Invalid filename");
		return;
	}

	if( !fs.existsSync(filename) ) {
		callback("Invalid input", filename + " does not exist");
		return;
	}	
	
	var paths = filename.split("/");
	var file = paths[paths.length-1];

	AxisDigest.upload( device, "overlay", file, options, fs.createReadStream(filename), function( error, response) {
		callback( error, response );
	});
}

exports.Upload_ACAP = function( device , options, callback ) {
	// options may be a filepath or a file buffer
	
	//If file buffer
	if( Buffer.isBuffer(options)  ) {
		AxisDigest.upload( device, "acap", "acap.eap", null, options, function( error, response) {
			callback( error, response );
		});
		return;
	}

	//If file path
	
	if( typeof options !== "string" ) {
		callback("Invalid input","Invalid filepath or buffer");
		return;
	}
	if( !fs.existsSync(options) ) {
		callback("Invalid input", options + " does not exist");
		return;
	}	

	AxisDigest.upload( device, "acap", "acap.eap", null, fs.createReadStream(options), function( error, response) {
		callback( error, response );
	});
}

exports.Accounts = function( device, action, options, callback) {
	switch( action ) {
		case "list":
			AxisDigest.get( device, '/axis-cgi/pwdgrp.cgi?action=get', "text", function( error, response ) {
				if( error ) {
					callback( true, error );
					return;
				}
				if( response.search("Error") >= 0 ) {
					callback( "Request failed", response);
					return;
				}
				AxisParser.Accounts2JSON( response, function( error, json ) {
					callback(error,json);
				});
			});
		break;
		case "set":
			if( !options ) {
				callback("Invalid input","No account data");
				return;
			}
			if( typeof options !== "string" && typeof options !== "object" ) {
				callback("Invalid input","No account data");
				return;
			}
			account = options;
			if( typeof account === "string" )
				account = JSON.parse(account);
			
			if( !account || !account.hasOwnProperty("name") || !account.hasOwnProperty("privileges") || !account.hasOwnProperty("password") ) {
				callback("Invalid input", "Missing account name, password or priviliges");
				return;
			}
		
			var cgi = '/axis-cgi/pwdgrp.cgi?action=update&user=' + account.name + '&pwd=' + encodeURIComponent(account.password);
			AxisDigest.get( device, cgi, "text", function( error, response ) {
				if( error ) {
					callback(error, response);
					return;
				}
				if( response.search("Error") >= 0 ) {
					var sgrp = "viewer";
					if( account.privileges.toLowerCase() === "viewer" || account.privileges.toLowerCase() === "player" )
						sgrp = "viewer";
					if( account.privileges.toLowerCase() === "operator" || account.privileges.toLowerCase() === "client" )
						sgrp = "viewer:operator:ptz";
					if( account.privileges.toLowerCase() === "admin" || account.privileges.toLowerCase() === "administrator" )
						sgrp = "viewer:operator:admin:ptz";
					if( account.privileges.toLowerCase() === "api" )
						sgrp = "operator:admin";
					cgi = '/axis-cgi/pwdgrp.cgi?action=add&user=' + account.name + '&pwd=' + encodeURIComponent(account.password) + '&grp=users&sgrp=' + sgrp + '&comment=node';
					AxisDigest.get( device, cgi, "text", function( error, response ) {	
						if( error ) {
							callback( true, response );
							return;
						}
						if( response.search("Error") >= 0 ) {
							callback( "Request failed", response );
							return;
						}
						callback( false, "OK" );
						return;
					});
					return;
				}
				callback( false, "OK" );
			});
		break;
		
		case "remove":
			if( !options || typeof options !== "string" ) {
				callback("Invalid input","Invalid account name");
				return;
			}
			var cgi  = "/axis-cgi/pwdgrp.cgi?action=remove&user=" + options;
			AxisDigest.get( device, path, "text", function( error, response ) {
				if( error ) {
					callback(error, response );
					return;
				}
				if( response.search("Error") >= 0 ) {
					callback( "Request failed", response);
					return;
				}
				callback(false,"OK");
			});
		break;
		
		default:
			callback("Invalid action",action + " is undfined");
		break;
	}
};

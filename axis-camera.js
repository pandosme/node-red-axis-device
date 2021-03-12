//Copyright (c) 2021 Fred Juhlin

const VapixWrapper = require('vapix-wrapper');

module.exports = function(RED) {
	
	function Axis_Camera(config) {
		RED.nodes.createNode(this,config);
		this.preset = config.preset;		
		this.action = config.action;
		this.resolution = config.resolution;
		this.output = config.output;
		this.options = config.options;
		this.filename = config.filename;
		
		var node = this;
		node.on('input', function(msg) {
			node.status({});
			var device = {
				address: null,
				user: null,
				password: null,
				protocol: "http"
			}

			var preset = RED.nodes.getNode(node.preset);
			if( preset ) {
				device.address = preset.address;
				device.user = preset.credentials.user;
				device.password = preset.credentials.password;
				device.protocol = preset.protocol || "http";
			}
			if( msg.address ) device.address = msg.address;
			if( msg.user ) device.user = msg.user;
			if( msg.password ) device.password = msg.password;
			
			var action = msg.action || node.action;
			var filename = msg.filename || node.filename;
			var options = node.options || msg.payload;
			
			msg.error = false;
			
			switch( action ) {
				case "JPEG Image":
					var resolution = "resolution=" + node.resolution;
					if( msg.resolution )
						resolution = "resolution=" + msg.resolution;
					VapixWrapper.JPEG( device, resolution, function( error, response) {
						msg.payload = response;
						msg.error = error;
						if( msg.error ) {
							node.warn(error);
						} else {
							if( node.output === "Base64" )
								msg.payload = response.toString('base64');
						}
						node.send(msg);
					});
				break;

				case "Camera Info":
					VapixWrapper.Param_Get( device, "properties", function( error, response ) {
//						console.log(action,"properties",response);
						var info = {};
						msg.error = error;
						msg.payload = response;
						if( error ) {
							msg.payload = info;
							node.send(msg);
							return;
						}
						if( !response.hasOwnProperty("Image") || !response.Image.hasOwnProperty("Format")) {
							msg.payload = info;
							msg.error = "No camera info";
							node.send(msg);
							return;
						}
						info.formats = response.Image.Format.split(","),
						info.resolutions = response.Image.Resolution.split(",")
						info.largest = info.resolutions[0];
						info.medium = "640x480";
						info.smallest = info.resolutions[info.resolutions.length-1];
						info.aspect = "4:3";
						info.rotation = 0;
						VapixWrapper.Param_Get( device, "ImageSource.I0", function( error, response ) {
//							console.log("ImageSource.I0",error, response);
							if( error || !response ) {
								msg.payload = info;
								msg.error = "Unable to read sensor properties";
								node.send( msg );
								return;
							}
							if( response.hasOwnProperty("I0") ) { 
								if( response.I0.hasOwnProperty("Sensor") && response.I0.Sensor.hasOwnProperty("AspectRatio") ) {
									info.aspect  = response.I0.Sensor.AspectRatio;
									if( info.aspect === "16:9")
										info.medium = "640x360";
									if( info.aspect === "4:3")
										info.medium = "640x480";
									if( info.aspect === "1:1")
										info.medium = "640x640";
									if( info.aspect === "16:10")
										info.medium = "640x400";
								}
								if( response.I0.hasOwnProperty("Rotation") )
									info.rotation = parseInt(response.I0.Rotation);
							}
							msg.payload = info;
							node.send(msg);
						});
					});
				break;

				case "Get Image settings":
					VapixWrapper.Param_Get( device, "ImageSource.I0.Sensor", function( error, response ) {
						msg.error = error;
						msg.payload = response;
						if(msg.error) {
							node.warn(error);
							node.send(msg);
							return;
						}
						var settings = {
							Brightness: parseInt(response.I0.Sensor.Brightness),
							ColorLevel: parseInt(response.I0.Sensor.ColorLevel),
							Contrast: parseInt(response.I0.Sensor.Contrast),
							Exposure: response.I0.Sensor.Exposure,
							WhiteBalance: response.I0.Sensor.WhiteBalance,
							WDR: response.I0.Sensor.WDR
						}
						VapixWrapper.Param_Get( device, "ImageSource.I0.DayNight", function( error, response ) {
							msg.error = error;
							msg.payload = response;
							if(msg.error) {  //Camera does not have DayNight
								msg.payload = settings;
								node.send( msg );
								return;
							}
							settings.DayLevel = parseInt(response.I0.DayNight.ShiftLevel);
							if( response.I0.IrCutFilter === "yes")
								settings.DayLevel = 100;
							if( response.I0.IrCutFilter === "no")
								settings.DayLevel = 0;
							msg.payload = settings;
							node.send(msg);
						});
					});
				break;

				case "Set Image settings":
					if( typeof options === "string" )
						options = JSON.parse(options);
					var sensor = JSON.parse( JSON.stringify(options) );
					delete sensor.DayLevel;
					VapixWrapper.Param_Set( device, "ImageSource.I0.Sensor", sensor, function( error, response ) {
						msg.error = error;
						msg.payload = response;
						if(msg.error) {
							node.warn(error);
							node.send(msg);
							return;
						};
						if( !options.hasOwnProperty("DayLevel") ) {
							node.send(msg);
							return;
						}
						var DayNight = {
							IrCutFilter: "auto",
							ShiftLevel: options.DayLevel
						}
						if( options.DayLevel === 0 )
							DayNight.IrCutFilter = "no";
						if( options.DayLevel === 100 )
							DayNight.IrCutFilter = "yes";
						VapixWrapper.Param_Set( device, "ImageSource.I0.DayNight", DayNight, function( error, response ) {
							msg.error = error;
							msg.payload = response;
							if(msg.error)
								node.warn(error);
							node.send( msg );
						});
					});
				break;

				case "Upload overlay":
					if(!filename || filename.length === 0 ) {
						node.status({fill:"red",shape:"dot",text:"Invalid filename"});
						msg.error = true;
						msg.payload = "Invalid filename";
						node.send(msg)
					}
					
					node.status({fill:"blue",shape:"dot",text:"Uploading image..."});
					if( typeof options === "number" || typeof options === "boolean" || typeof options === "undefined" )
						options = null;
					if( typeof options === "string" )
						options = JSON.parse( options );
					VapixWrapper.Upload_Overlay( device, filename, options, function(error, response){
						msg.error = error;
						msg.payload = response;
						if( error ) {
							node.status({fill:"red",shape:"dot",text:"Upload failed"});
						} else {
							node.status({fill:"green",shape:"dot",text:"Upload success"});
							msg.payload = "Upload complete";
						}
						node.send(msg);
					});
				break;
				
				default:
					node.warn( action + "is not yet implemented");
				break;

			}
        });
    }
	
    RED.nodes.registerType("axis-camera",Axis_Camera,{
		defaults: {
			preset: {type:"axis-preset"},
			action: { type:"text" },
			resolution: { type:"text" },
			output: { type:"text" },
			options: { type:"text" },
			filename: { type:"text" }
		}		
	});
}


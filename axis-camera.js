const vapix = require('./vapix.js');

module.exports = function(RED) {
	
	function Axis_Camera(config) {
		RED.nodes.createNode(this,config);
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.resolution = config.resolution;
		this.output = config.output;
		this.options = config.options;
		this.filename = config.filename;
		
		var node = this;
		node.on('input', function(msg) {
			var account = RED.nodes.getNode(node.account);
			var address = msg.address || node.address;
			var action = msg.action || node.action;
			var filename = msg.filename || node.filename;
			var options = node.options || msg.payload;
			
			var device = {
				url: account.protocol + '://' + address,
				user: msg.user || account.name,
				password: msg.password || account.credentials.password
			}
			if( !device.user || device.user.length < 2){
				msg.error = true;
				msg.payload = "Invalid user account name";
				node.warn(msg.payload);
				node.send(msg);
				return;
			}
			if( !device.password || device.password.length < 2){
				msg.error = true;
				msg.payload = "Invalid account password";
				node.warn(msg.payload);
				node.send(msg);
				return;
			}
			if( !device.url || device.url.length < 3) {
				msg.error = true;
				msg.payload = "Invalid device address";
				node.warn(msg.payload);
				node.send(msg);
				return;
			}
			msg.error = false;
			
			switch( action ) {
				case "JPEG Image":
					var resolution = "resolution=" + node.resolution;
					if( msg.resolution )
						resolution = "resolution=" + msg.resolution;
					vapix.JPEG( device, resolution, function( error, response) {
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
					vapix.DeviceInfo( device, function(error, response ) {
						msg.error = error;
						msg.payload = response;
						if(msg.error)
							node.warn(error);
						else
							msg.payload = response.camera;
						node.send(msg);
					});
				break;

				case "Get Image settings":
					vapix.GetParam( device, "ImageSource.I0.Sensor", function( error, response ) {
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
						vapix.GetParam( device, "ImageSource.I0.DayNight", function( error, response ) {
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
					vapix.SetParam( device, "ImageSource.I0.Sensor", sensor, function( error, response ) {
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
						vapix.SetParam( device, "ImageSource.I0.DayNight", DayNight, function( error, response ) {
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
					vapix.Upload_Overlay( device, filename, options, function(error, response){
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
            name: {type:"text"},
			account: {type:"axis-config"},
			address: {type:"text"},
			action: { type:"text" },
			resolution: { type:"text" },
			output: { type:"text" },
			options: { type:"text" },
			filename: { type:"text" }
		}		
	});
}


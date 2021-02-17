const vapix = require('./vapix.js');

module.exports = function(RED) {
	
	function Axis_Camera(config) {
		RED.nodes.createNode(this,config);
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.resolution = config.resolution;
		this.output = config.output;
		var node = this;
		node.on('input', function(msg) {
			var account = RED.nodes.getNode(node.account);
			var address = msg.address || node.address;
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
			var action = msg.action || node.action;
			msg.error = false;
			
			switch( action ) {
				case "JPEG Image":
					var resolution = "resolution=" + node.resolution;
					if( msg.resolution )
						resolution = "resolution=" + msg.resolution;
					console.log("JPEG Image", {
						noderes: node.resolution,
						msgres: msg.resolution,
						output: node.output,
						profile: resolution
					});
					vapix.JPEG( device, resolution, function( error, response) {
						msg.payload = response;
						msg.error = error;
						if( msg.error ) {
							msg.payload = "Image capture failed";
							node.warn(error);
						} else {
							console.log( typeof resonse );
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
						if(msg.error)
							node.warn(error);
						else {
							msg.payload = {
								Brightness: parseInt(response.I0.Sensor.Brightness),
								ColorLevel: parseInt(response.I0.Sensor.ColorLevel),
								Contrast: parseInt(response.I0.Sensor.Contrast),
								Exposure: response.I0.Sensor.Exposure,
								WhiteBalance: response.I0.Sensor.WhiteBalance,
								WDR: response.I0.Sensor.WDR
							}
						}
						node.send(msg);
					});
				break;

				case "Set Image settings":
					vapix.SetParam( device, "ImageSource.I0.Sensor", msg.payload, function( error, response ) {
						msg.error = error;
						msg.payload = response;
						if(msg.error)
							node.warn(error);
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
			output: { type:"text" }
		}		
	});
}


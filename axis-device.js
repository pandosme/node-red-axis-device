const VapixWrapper = require('vapix-wrapper');

module.exports = function(RED) {
	
    function Axis_Device(config) {
		RED.nodes.createNode(this,config);
		this.preset = config.preset;
		this.action = config.action;
		this.cgi = config.cgi;
		this.data = config.data;
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
			var data = node.data || msg.payload;
			var filename = msg.filename || node.filename;
			
//			console.log("axis-device", {address: device.address,action: action,data: data,filename: filename});
			
			msg.error = false;
			
			switch( action ) {
				case "Device Info":
					VapixWrapper.DeviceInfo( device, function(error, response ) {
//						console.log("DeviceInfo:", error, response);
						msg.error = error;
						if(msg.error)
							node.warn(error);
						msg.payload = response;
						node.send(msg);
					});
				break;

				case "Network settings":
					var request = {
						"apiVersion": "1.0",
						"context": "nodered",
						"method": "getNetworkInfo",
						"params":{}
					}
					VapixWrapper.CGI_Post( device, "/axis-cgi/network_settings.cgi", request, function(error, response ) {
						msg.error = error;
						if(msg.error)
							node.warn("Network info request failed");
						msg.payload = response;
						if( typeof msg.payload === "string" ) { 
							var json = JSON.parse(response);
							if( json )
								msg.payload = json;
						}
						msg.payload.hasOwnProperty("error")
							msg.error = msg.payload.error;
						msg.payload.hasOwnProperty("data")
							msg.payload = msg.payload.data;
						node.send(msg);
					});
				break;
				
				case "Restart":
					VapixWrapper.CGI( device, '/axis-cgi/restart.cgi', function(error, response) {
						msg.error = error;
						msg.payload = response;
						if( error ) {
							node.send(msg);
							return;
						}
						node.send(msg);
						msg.payload = "Device restarting...";
					});
				break;

				case "Upgrade firmware":
					var firmware = filename || msg.payload
					node.status({fill:"blue",shape:"dot",text:"Updating firmware..."});
					VapixWrapper.Upload_Firmare( device , firmware, function(error, response ) {
						msg.payload = response;
						msg.error = error;
						if(msg.error) {
							node.warn("Device upgrade failed");
							node.status({fill:"red",shape:"dot",text:"Device upgrade failed"});
						} else {
							node.status({fill:"green",shape:"dot",text:"Device upgrade success"});
							msg.payload = "Device upgraded and restarted";
						}
						node.send(msg);
					});
				break;
				
				case "HTTP Get":
					var cgi = node.cgi || msg.cgi;
					if( !cgi || cgi.length < 2 ) {
						msg.error = "Invalid cgi";
						node.warn(msg.error);
						return;
					}
					VapixWrapper.HTTP_Get( device, cgi, "text", function(error, response ) {

						msg.error = error;
						msg.payload = response;
						if( typeof msg.payload === "string") {
							if( msg.payload[0] === '{' || msg.payload[0] === '[' ) {
								var json = JSON.parse(response);
								if( json )
									msg.payload = json;
							}
						}
						node.send(msg);
					});
				break;
				
				case "HTTP Post":
					var cgi = node.cgi || msg.cgi;
					if( !cgi || cgi.length < 2 ) {
						msg.error = "Invalid cgi";
						node.warn(msg.error);
						return;
					}
					if(!data) {
						msg.error = "Invalid payload";
						node.warn(msg.error);
						node.send(msg);
						return;
					}
					node.status({fill:"blue",shape:"dot",text:"Requesting..."});
					VapixWrapper.HTTP_Post( device, cgi, data, "text", function(error, response ) {
						msg.error = error;
						if( error )
							node.status({fill:"red",shape:"dot",text:"Request failed"});
						else
							node.status({fill:"green",shape:"dot",text:"Request success"});
						if( typeof response === "string" && (response[0] === '{' << response[0] === '[') )
							msg.payload =  JSON.parse(response);
						else
							msg.payload = response;
						node.send(msg);
					});
				break;

				case "Syslog":
					VapixWrapper.Syslog( device, function( error, response) {
						msg.payload = response;
						msg.error = error;
						node.send(msg);
					});
				break;

				case "Connections":
					VapixWrapper.Connections( device, function( error, response) {
						msg.payload = response;
						msg.error = error;
						node.send(msg);
					});
				break;

				case "Get location":
					VapixWrapper.Location_Get( device, function( error, response) {
						msg.payload = response;
						msg.error = error;
						node.send(msg);
					});
				break;

				case "Set location":
					if(!data || typeof data === "number" || typeof data === "boolean") {
						msg.error = "Invalid input";
						msg.payload = "Invalid location data";
						node.send(msg);
						return;
					}
					VapixWrapper.Location_Set( device, data, function( error, response) {
						msg.payload = response;
						msg.error = error;
						node.send(msg);
					});
				break;
				
				default:
					msg.error = "Action " + action + " is undefined";
					msg.payload = "Action " + action + " is undefined";
					node.warn(msg.error);
					node.send(msg);
					return;
			}
        });
    }
	
    RED.nodes.registerType("axis-device",Axis_Device,{
		defaults: {
			preset: {type:"axis-preset"},
			action: { type:"text" },
			data: {type: "text"},
			cgi: {type: "text"},
			filename: { type:"text" }
		}		
	});
}


const vapix = require('./vapix.js');

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
			var address = null;
			var user = null;
			var password = null;
			var protocol = "http";
			var preset = RED.nodes.getNode(node.preset);

			if( preset ) {
				address = preset.address;
				user = preset.credentials.user;
				password = preset.credentials.password;
				protocol = preset.protocol || "http";
			}
			if( msg.address )
				address = msg.address;
			if(!address || address.length < 3) {
				msg.error = "Address undefined";
				node.warn(msg.error);
				return;
			}
			
			if( msg.user )	user = msg.user;
			if(!user || user.length < 2) {
				msg.error = "User name undefined";
				node.warn(msg.error);
				return;
			}
			
			if( msg.password )
				password = msg.password;
			if(!password || password.length < 3) {
				msg.error = "Password undefined";
				node.warn(msg.error);
				return;
			}

			var device = {
				url: protocol + '://' + address,
				user: user,
				password: password
			}

			node.status({});
			var action = msg.action || node.action;
			var payload = node.data || msg.payload;
			var filename = msg.filename || node.filename;
			msg.error = false;
			
			switch( action ) {
				case "Device Info":
					vapix.DeviceInfo( device, function(error, response ) {
						msg.error = error;
						if(msg.error)
							node.warn(error);
						msg.payload = response;
						node.send(msg);
					});
				break;

				case "Network settings":
					var body = {
						"apiVersion": "1.0",
						"context": "nodered",
						"method": "getNetworkInfo",
						"params":{}
					}
					vapix.Post( device, "/axis-cgi/network_settings.cgi", body,"json", function(error, response ) {
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
					vapix.Reboot( device, function( error, response) {
						msg.payload = response;
						msg.error = error;
						if( msg.error ) {
							node.warn("Device restart failed");
						}
						node.send(msg);
					});
				break;

				case "Upgrade firmware":
					node.status({fill:"blue",shape:"dot",text:"Updating firmware..."});
					var data = filename || msg.payload;
					vapix.Upload_Firmare( device , data, function(error, response ) {
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
					vapix.Get( device, cgi, "text", function(error, response ) {
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
					if(!payload) {
						msg.error = "Invalid payload";
						node.warn(msg.error);
						node.send(msg);
						return;
					}
					node.status({fill:"blue",shape:"dot",text:"Requesting..."});
					
					vapix.Post( device, cgi, payload, "text", function(error, response ) {
						if( error )
							node.status({fill:"red",shape:"dot",text:"Request failed"});
						else
							node.status({fill:"red",shape:"dot",text:"Request success"});
							
						msg.error = error;
						msg.payload = response;
						if( typeof msg.payload === "string" && (msg.payload[0] === '{' || msg.payload[0] === '[') ) {
							var json = JSON.parse(response);
							if( json )
								msg.payload = json;
						}
						node.send(msg);
					});
				break;

				case "Syslog":
					vapix.Syslog( device, function( error, response) {
						msg.payload = response;
						msg.error = error;
						node.send(msg);
					});
				break;

				case "Get time":
					vapix.GetTime( device, function( error, response) {
						msg.payload = response;
						msg.error = error;
						node.send(msg);
					});
				break;

				case "Connections":
					vapix.Connections( device, function( error, response) {
						msg.payload = response;
						msg.error = error;
						node.send(msg);
					});
				break;

				case "Get location":
					vapix.GetLocation( device, function( error, response) {
						msg.payload = response;
						msg.error = error;
						node.send(msg);
					});
				break;

				case "Set location":
					if(!payload || typeof payload === "number" || typeof payload === "boolean") {
						msg.error = "Invalid input";
						msg.payload = "Invalid location data";
						node.send(msg);
						return;
					}
					vapix.SetLocation( device, payload, function( error, response) {
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


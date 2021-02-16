const Axis = require('./Axis.js');

module.exports = function(RED) {
	
    function Axis_Device(config) {
		RED.nodes.createNode(this,config);
//		console.log("Axis_Device: Config:",config);	
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.cgi = config.cgi;
		this.data = config.data;
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
			var payload = node.data || msg.payload;
			msg.error = false;
			switch( action ) {
				case "Device Info":
					Axis.DeviceInfo( device, function(error, response ) {
						msg.error = error;
						msg.payload = response;
						node.warn("Device request failed");
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
					Axis.Post( device, "/axis-cgi/network_settings.cgi", body, function(error, response ) {
						msg.error = error;
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
				
				case "Reboot":
					msg.error = "Not yet implemented";
					node.warn(msg.error);
					node.send(msg);
				break;

				case "Upgrade firmware":
					msg.error = "Not yet implemented";
					node.warn(msg.error);
					node.send(msg);
				break;
				
				case "HTTP Get":
					var cgi = node.cgi || msg.cgi;
					if( !cgi || cgi.length < 2 ) {
						msg.error = "Invalid cgi";
						node.warn(msg.error);
						return;
					}
					Axis.Get( device, cgi, function(error, response ) {
						msg.error = error;
						msg.payload = response;
						if( typeof msg.payload === "string" ) {
							var json = JSON.parse(response);
							if( json )
								msg.payload = json;
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
					Axis.Post( device, cgi, payload, function(error, response ) {
						msg.error = error;
						msg.payload = response;
						if( typeof msg.payload === "string" ) {
							var json = JSON.parse(response);
							if( json )
								msg.payload = json;
						}
						node.send(msg);
					});
				break;
				default:
					msg.error = "Invalid action";
					node.warn(msg.error);
					node.send(msg);
					return;
			}
        });
    }
	
    RED.nodes.registerType("axis-device",Axis_Device,{
		defaults: {
            name: {type:"text"},
			account: {type:"axis-config"},
			address: {type:"text"},
			data: {type: "text"},
			cgi: {type: "text"},
			action: { type:"text" }
		}		
	});
}


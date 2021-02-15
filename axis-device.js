const Axis = require('./Axis.js');

module.exports = function(RED) {
	function Axis_Device_Account(config) {
		RED.nodes.createNode(this,config);
//		console.log("Axis_Device_Account",config);
		this.name = config.name;
		this.protocol = config.protocol;
	}
	
	RED.nodes.registerType("Axis Device Account",Axis_Device_Account,{
		defaults: {
			name: {type: "text"},
			protocol: {type:"text"}
		},
		credentials: {
			password: {type:"password"}
		}		
	});
	
    function Axis_Device(config) {
		RED.nodes.createNode(this,config);
//		console.log("Axis_Device: Config:",config);	
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.cgi = config.cgi;
		this.data = config.data;
		this.format = config.format;
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
				msg.payload = "Invalid input:  Missing user name";
				node.send(msg);
				return;
			}
			if( !device.password || device.password.length < 2){
				msg.error = true;
				msg.payload = "Invalid input: Missing password";
				node.send(msg);
				return;
			}
			if( !device.url || device.url.length < 5) {
				msg.error = true;
				msg.payload = "Invalid input: Missing device address";
				node.send(msg);
				return;
			}
//			var format = node.format;
			var action = msg.action || node.action;
			var payload = node.data || msg.payload;
			var cgi = node.cgi || msg.topic;
/*			
			console.log("Axis_Device ",{
				action: action,
				cgi: cgi,
				payload: payload
			});
*/			
			msg.error = false;
			switch( action ) {
				case "Device Info":
					Axis.DeviceInfo( device, function(error, response ) {
						msg.error = error;
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
					Axis.Post( device, "/axis-cgi/network_settings.cgi", body, function(error, response ) {
						msg.error = error;
//						console.log("Network settings Response", error, response);
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
				case "HTTP Get":
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
					msg.error = true;
					msg.payload = "Invalid action (" + action+ ")";
					node.send(msg);
					return;
			}
        });
    }
	
    RED.nodes.registerType("Axis Device",Axis_Device,{
		defaults: {
            name: {type:"text"},
			account: {type:"Axis Device Account"},
			address: {type:"text"},
			data: {type: "text"},
			action: { type:"text" }
		}		
	});
}


const vapix = require('./vapix.js');

module.exports = function(RED) {
	function Axis_Device_Account(config) {
		RED.nodes.createNode(this,config);
		console.log("Axis_Device_Account",config);
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
		console.log("Axis_Device: Config:",config);	
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.data = config.data;
		this.format = config.format;
		var node = this;
		node.on('input', function(msg) {
			var account = RED.nodes.getNode(node.account);
			console.log("Axis_Device/ ",account);
			var address = msg.address || node.address;
			var camera = {
				url: account.protocol + '://' + address,
				user: msg.user || account.name,
				password: msg.password || account.credentials.password
			}
			if( !camera.user || camera.user.length < 2){msg.error = true;msg.payload = "Invalid input [user]";node.send(msg);return;}
			if( !camera.password || camera.password.length < 2){msg.error = true;msg.payload = "Invalid input [password]";node.send(msg);return;}
			if( !camera.url || camera.url.length < 10) {msg.error = true;msg.payload = "Invalid input [url])";node.send(msg);return;}
			var format = node.format;
			var action = msg.action || node.action;
			var payload = node.data || msg.payload;
			msg.error = false;
			switch( action ) {
				case "Info":
					msg.error = false;
					var info = {
						serial: "Undefined",
						type: "Undefined",
						model: "Undefined",
						IPv4: "Undefined",
						IPv6: "Undefined",
						hostname: "Undefined",
						platform: "Undefined",
						chipset: "Undefined",
						firmware: "Undefined"
					};
					//Brand
					vapix.getParam( camera, "brand", function( error, response ) {
						msg.error = false;
						if( error ) {
							msg.error = true;
							msg.payload = {
								request: "brand",
								error: error,
								response: response,
								device: info
							}
							node.send( msg );
							return;
						}
						if( response.hasOwnProperty("ProdNbr") )
							info.model = response.ProdNbr;
						if( response.hasOwnProperty("ProdType") )
							info.type = response.ProdType;
						vapix.getParam( camera, "network", function( error, response ) {
							if( error ) {
								msg.error = true;
								msg.payload = {
									request: "network",
									error: error,
									response: response,
									device: info
								}
								node.send( msg );
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
							}
							//Properties
							vapix.getParam( camera, "properties", function( error, response ) {
								if( error ) {
									msg.error = true;
									msg.payload = {
										request: "properties",
										error: error,
										response: response,
										device: info
									}
									node.send( msg );
									return;
								}
								if( response.hasOwnProperty("Firmware") && response.Firmware.hasOwnProperty("Version"))
									info.firmware = response.Firmware.Version;
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
								}
								msg.payload = info;
								node.send( msg );
							});
						});
					});
				break;

				case "HTTP GET":
					vapix.get( camera, payload, function( error, body ) {
						msg.payload = body;
						if( error ) {
							msg.error = true;
							node.send(msg);
							return;
						}
						var json = JSON.parse(body);
						if( json )
							msg.payload = json;
						node.send(msg);
					});
				break;

				case "HTTP POST":
					if( !msg.url || msg.url.length < 5 ) {
						msg.error=true;
						msg.payload = "Invalid msg.url";
						node.send(msg);
						return;
					}
					vapix.postBody( camera, msg.url, payload, function( error, body ) {
						msg.payload = body;
						if( error ) {
							msg.error = true;
							node.send(msg);
							return;
						}
						var json = JSON.parse(body);
						if( json )
							msg.payload = json;
						node.send(msg);
					});
				break;
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


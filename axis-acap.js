const vapix = require('./vapix.js');

module.exports = function(RED) {
	function Axis_ACAP(config) {
		RED.nodes.createNode(this,config);
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.acap = config.acap;
		this.filename = config.filename;
		var node = this;
		node.on('input', function(msg) {
			var account = RED.nodes.getNode(node.account);
			var address = msg.address || node.address;
			var acap = msg.acap || node.acap;
			var filename = msg.filename || node.filename;
			node.status({});
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
				case "ACAP Status":
				
					vapix.ACAP_List( device, function( error, list ) {
						msg.error = error;
						msg.payload = list;
						if( acap ) {
							var selectedACAP = null;
							list.forEach( function( item ){
								if( item.Name === acap )
									selectedACAP = item;
							});
							if( selectedACAP )
								msg.payload = selectedACAP;
						}
						node.send(msg);
					});
				break;

				case "Start ACAP":
					if(!acap) {
						msg.error = true;
						msg.payload = "Invalid ACAP ID";
						node.warn(msg.payload);
						node.send(msg);
						return;
					}
					vapix.ACAP_Control( device, "start", acap, function(error, response){
						msg.error = error;
						msg.payload = response;
						node.send(msg);
					});
				break;

				case "Stop ACAP":
					if(!acap) {
						msg.error = true;
						msg.payload = "Invalid ACAP ID";
						node.warn(msg.payload);
						node.send(msg);
						return;
					}
					vapix.ACAP_Control( device, "stop", acap, function(error, response){
						msg.error = error;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case "Remove ACAP":
					if(!acap) {
						msg.error = true;
						msg.payload = "Invalid ACAP ID";
						node.warn(msg.payload);
						node.send(msg);
						return;
					}
					vapix.ACAP_Control( device, "remove", acap, function(error, response){
						msg.error = error;
						msg.payload = response;
						node.send(msg);
					});
				break;

				case "Install ACAP":
					var data = filename || msg.payload;
					node.status({fill:"blue",shape:"dot",text:"Installing ACAP..."});
					vapix.Upload_ACAP( device, data, function(error, response){
						msg.error = error;
						msg.payload = response;
						if( error ) {
							node.status({fill:"red",shape:"dot",text:"ACAP installation failed"});
						} else {
							node.status({fill:"green",shape:"dot",text:"ACAP installed"});
							msg.payload = "ACAP installed";
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
	
    RED.nodes.registerType("axis-acap", Axis_ACAP,{
		defaults: {
            name: {type:"text"},
			account: {type:"axis-config"},
			address: {type:"text"},
			action: { type:"text" },
			acap: { type:"text" },
			filename: { type:"text" }
		}		
	});
}


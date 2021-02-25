const vapix = require('./vapix.js');

module.exports = function(RED) {
	function Axis_Security(config) {
		RED.nodes.createNode(this,config);
		this.preset = config.preset;
		this.action = config.action;
		this.options = config.options;

		var node = this;
		node.on('input', function(msg) {
			node.status({});
			var address = null;
			var user = null;
			var password = null;
			var protocol = "http";
			var preset = RED.nodes.getNode(node.preset);
			console.log(node.preset,preset);
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

			var action = msg.action || node.action;
			var options = node.options || msg.payload;
			msg.error = false;
			
			switch( action ) {
				case "List accounts":
					vapix.Accounts( device, "list", null, function(error, response){
						msg.error = error;
						msg.payload = response;
						node.send(msg);
					});
				break;

				case "Set account":
					//options can be JSON string or object and must include name,password & priviliges
					vapix.Accounts( device, "set", options, function(error, response){
						msg.error = error;
						msg.payload = response;
						node.send(msg);
					});
				break;

				case "Remove account":
					vapix.Accounts( device, "remove", options, function(error, response){
						msg.error = error;
						msg.payload = response;
						node.send(msg);
					});
				break;

				case "List certificates":
					vapix.Certificates_List( device, function(error, response){
						msg.error = error;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case "Request CSR":
					if(!options || t) {
						msg.error = "Invalid input";
						msg.payload = "Missing CSR data";
						node.send(msg);
					}
					vapix.Certificates_CSR( device, options, function(error, response){
						msg.error = error;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				default:
					node.warn( action + "is not yet implemented");
				break;
			}
        });
    }
	
    RED.nodes.registerType("axis-security", Axis_Security,{
		defaults: {
			preset: {type:"axis-preset"},
			address: {type:"text"},
			action: { type:"text" },
			options: { type:"text" }
		}		
	});
}


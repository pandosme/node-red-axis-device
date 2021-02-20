const vapix = require('./vapix.js');

module.exports = function(RED) {
	function Axis_Security(config) {
		RED.nodes.createNode(this,config);
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.options = config.options;

		var node = this;
		node.on('input', function(msg) {
			var account = RED.nodes.getNode(node.account);
			var address = msg.address || node.address;
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
			var action = msg.action || node.action;
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
            name: {type:"text"},
			account: {type:"axis-config"},
			address: {type:"text"},
			action: { type:"text" },
			options: { type:"text" }
		}		
	});
}


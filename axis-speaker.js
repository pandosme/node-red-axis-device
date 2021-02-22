const vapix = require('./vapix.js');

module.exports = function(RED) {
	function Axis_Speaker(config) {
		RED.nodes.createNode(this,config);
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.options = config.options;
		
		this.data = config.data;
		var node = this;
		node.on('input', function(msg) {
			var action = msg.action || node.action;
			var account = RED.nodes.getNode(node.account);
			var address = msg.address || node.address;
			var options = msg.options || node.options;
			var data = node.data || msg.payload;
			
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
				case "Action 1":
					msg.payload = {
						action: action,
						data: data,
						options: options
					}
					node.send(msg);
				break;

				case "Action 2":
					msg.payload = {
						action: action,
						data: data,
						options: options
					}
					node.send(msg);
				break;
				
				default:
					node.warn( action + "is not yet implemented");
				break;
			}
        });
    }
	
    RED.nodes.registerType("axis-speaker", Axis_Speaker,{
		defaults: {
            name: {type:"text"},
			account: {type:"axis-config"},
			address: {type:"text"},
			action: { type:"text" },
			options: { type:"text" },
			data: { type:"text" }
		}		
	});
}


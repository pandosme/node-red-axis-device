const vapix = require('./vapix.js');

module.exports = function(RED) {
	function Axis_Speaker(config) {
		RED.nodes.createNode(this,config);
		this.preset = config.preset;
		this.action = config.action;
		this.options = config.options;
		
		this.data = config.data;
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
			var options = msg.options || node.options;
			var data = node.data || msg.payload;
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
			preset: {type:"axis-preset"},
			action: { type:"text" },
			options: { type:"text" },
			data: { type:"text" }
		}		
	});
}


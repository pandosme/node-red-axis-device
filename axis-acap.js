const vapix = require('./vapix.js');

module.exports = function(RED) {
	function Axis_ACAP(config) {
		RED.nodes.createNode(this,config);
		this.preset = config.preset;		
		this.action = config.action;
		this.acap = config.acap;
		this.filename = config.filename;
		var node = this;
		node.on('input', function(msg) {
			node.status({});
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
			
			var action = msg.action || node.action;
			var acap = msg.acap || node.acap;
			var filename = msg.filename || node.filename;
			
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
					node.status({fill:"blue",shape:"dot",text:"Starting ACAP..."});
					if(!acap) {
						node.status({fill:"red",shape:"dot",text:"Starting ACAP failed"});
						msg.error = true;
						msg.payload = "Invalid ACAP ID";
						node.warn(msg.payload);
						node.send(msg);
						return;
					}
					vapix.ACAP_Control( device, "start", acap, function(error, response){
						if( error )
							node.status({fill:"red",shape:"dot",text:"Starting ACAP failed"});
						else
							node.status({fill:"green",shape:"dot",text:"ACAP started"});

						msg.error = error;
						
						msg.payload = response;
						node.send(msg);
					});
				break;

				case "Stop ACAP":
					node.status({fill:"blue",shape:"dot",text:"Stopping ACAP..."});
					if(!acap) {
						node.status({fill:"blue",shape:"dot",text:"Stopping ACAP failed"});
						msg.error = true;
						msg.payload = "Invalid ACAP ID";
						node.warn(msg.payload);
						node.send(msg);
						return;
					}
					vapix.ACAP_Control( device, "stop", acap, function(error, response){
						if( error )
							node.status({fill:"blue",shape:"dot",text:"Stopping ACAP failed"});
						else
							node.status({fill:"green",shape:"dot",text:"ACAP stopped"});
							
						msg.error = error;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case "Remove ACAP":
					node.status({fill:"blue",shape:"dot",text:"Removing ACAP..."});
					if(!acap) {
						node.status({fill:"red",shape:"dot",text:"Removing ACAP failed"});
						msg.error = true;
						msg.payload = "Invalid ACAP ID";
						node.warn(msg.payload);
						node.send(msg);
						return;
					}
					vapix.ACAP_Control( device, "remove", acap, function(error, response){
						if( error )
							node.status({fill:"red",shape:"dot",text:"Removing ACAP failed"});
						else	
							node.status({fill:"green",shape:"dot",text:"ACAP removed"});
						msg.error = error;
						msg.payload = response;
						node.send(msg);
					});
				break;

				case "Install ACAP":
					var data = filename || msg.payload;
					node.status({fill:"blue",shape:"dot",text:"Installing ACAP..."});
					vapix.Upload_ACAP( device, data, function(error, response){
						msg.acap = null;
//						console.log("axis-acap", response);
						msg.error = error;
						msg.payload = response;
						if( error ) {
							node.status({fill:"red",shape:"dot",text:"ACAP installation failed"});
						} else {
							if( typeof response === "object" && response.hasOwnProperty("data") )
								msg.acap = response.data.id;
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
			preset: {type:"axis-preset"},
			action: { type:"text" },
			acap: { type:"text" },
			filename: { type:"text" }
		}		
	});
}


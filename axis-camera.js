const Axis = require('./Axis.js');

module.exports = function(RED) {
	
	function Axis_Camera(config) {
		RED.nodes.createNode(this,config);
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		var node = this;
		node.on('input', function(msg) {
			node.send(msg);
        });
    }
	
    RED.nodes.registerType("axis-camera",Axis_Camera,{
		defaults: {
            name: {type:"text"},
			account: {type:"axis-config"},
			address: {type:"text"},
			action: { type:"text" }
		}		
	});
}


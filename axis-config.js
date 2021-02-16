module.exports = function(RED) {
	function Axis_Config_Node(config) {
		RED.nodes.createNode(this,config);
//		console.log("Axis_Device_Account",config);
		this.name = config.name;
		this.protocol = config.protocol;
	}
	
	RED.nodes.registerType("axis-config", Axis_Config_Node,{
		defaults: {
			name: {type: "text"},
			protocol: {type:"text"}
		},
		credentials: {
			password: {type:"password"}
		}		
	});
}
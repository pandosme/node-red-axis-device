var exports = module.exports = {};
const xml2js = require('xml2js');

exports.param2json = function( data ) {
	var rows = data.split('\n');
	var result = {};
	rows.forEach(function(row){
		row = row.trim();
		if( row.length > 5) {
			var items = row.split('=');
			var props = items[0].split('.');
			var prop = result;
			for( i = 2; i < props.length; i++ ) {
				if( prop.hasOwnProperty(props[i]) ) {
					prop = prop[props[i]];
				} else {
					if( i === props.length - 1 ) {
						if( items.length > 1 ) {
							prop[props[i]] = items[1];
							if( items[1] === 'yes' )
								prop[props[i]] = true;
							if( items[1] === 'no' )
								prop[props[i]] = false;
						} else {
							prop[props[i]] = "";
						}
					} else {
						prop[props[i]] = {};
					}
					prop = prop[props[i]];
				}
			}
		}
	});
	return result;
}

exports.AcapList2JSON = function( xml, callback ) {
	var parser = new xml2js.Parser({
		explicitArray: false,
		mergeAttrs: true
	});
		
	parser.parseString(xml, function (err, result) {
		if( err ) {
			callback( true, "XML parse error");
			return;
		}
		var json = result;
		if( !json.hasOwnProperty("reply")) {
			callback( true, "json parse error");
			return;
		}
		json = json.reply;
		if( !json.hasOwnProperty("result") || json.result !== "ok" || !json.hasOwnProperty("application")) {
			callback( false, []);
			return;
		}
		if( !Array.isArray(json.application) ) {
			var list = [];
			list.push(json.application);
			callback(false,list);
			return;
		}
		callback(false,json.application);
	});
}

exports.Accounts2JSON = function( data, callback ) {
	var accounts = [];
	var admins = [];
	var operators = [];
	var viewers = [];
	var rows = data.split('\n');
	rows.forEach(function(line){
		line = line.trim();
		items = line.split('=');
		if( items.length === 2 ) {
			account = items[0];
			users = items[1].replace(/[&\/\\#+()$~%.'":*?<>{}]/g, '');
			users = users.split(',');
			if( account === 'users')
				accounts = users;
			if( account === 'admin')
				admins = users;
			if( account === 'viewer')
				viewers = users;
			if( account === 'operator')
				operators = users;
		}
	})
	
	list = [
		{
			name: "root",
			priviliges: "System"
		}
	];
	accounts.forEach(function(account){
		var privileges = "Undefined";
		viewers.forEach(function(name){
			if( account === name )
				privileges = "Viewer"
		})
		operators.forEach(function(name){
			if( account === name )
				privileges = "Operator"
		})
		admins.forEach(function(name){
			if( account === name )
				privileges = "Admin"
		})
		list.push({
			name: account,
			privileges: privileges
		})    
	})
	callback( false, list );
}
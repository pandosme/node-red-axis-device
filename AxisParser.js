var exports = module.exports = {};
const xml2js = require('xml2js');

exports.param2json = function( data ) {
//	console.log("AxisParser.param2json", data );

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


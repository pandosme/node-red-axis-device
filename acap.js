const vapix = require('./vapix.js');
const xml2js = require('xml2js');

var exports = module.exports = {};

exports.list = function( camera, callback ) {
	vapix.get( camera, '/axis-cgi/applications/list.cgi', function( error, response )	{
		if( error ) {
			callback( true, response );
			return;
		}
		if( response.search("Error") >= 0 ) {
			callback( true, response );
			return;
		}
		var parser = new xml2js.Parser({
			explicitArray: false,
			mergeAttrs: true
		});
		
		parser.parseString(response, function (err, result) {
			if( err ) {
				callback( true, "XML parse error");
				return;
			}
			var data = result;
			if( !data.hasOwnProperty("reply")) {
				callback( true, "XML parse error");
				return;
			}
			data = data.reply;
			if( !data.hasOwnProperty("result") || data.result !== "ok" || !data.hasOwnProperty("application")) {
				callback( false, []);
				return;
			}
			if( !Array.isArray(data.application) ) {
				var list = [];
				list.push(data.application);
				callback(false,list);
				return;
			}
			callback(false,data.application);
		});
	});
}

exports.control = function( camera, action, acapID, callback ) {
	if( !action || action.length == 0 ) {
		callback( true, "Invalid ACAP control action");
		return;
	}
	
	if( !acapID || acapID.length == 0 || acapID.length > 20 ) {
		callback( true, "Invalid ACAP ID");
		return;
	}
	
	var path =  '/axis-cgi/applications/control.cgi?action=' + action + '&package=' + acapID;
	exports.get( camera, path, function(error, response) {
		if( error ) {
			callback( true, response );
			return;
		}
		response = response.trim();
		switch( response ) {
			case "OK":
			case "Error: 6":  //Application is already running
			case "Error: 7":  //Application is not running
				callback( false, "OK");
			break;
			case "Error: 4":
				callback( true, "Invalid ACAP");
			break;
			default:
				callback( true, response );
			break;
		}
	});
}

exports.cgi = function( camera, acapID, cgi, callback ) {
	console.log("exports.cgi");
	if( !camera ) {
		callback(true, "Invalid camera");
		return;
	}
	if( !acapID || typeof acapID !== "string" || acapID.length === 0 ) {
		callback(true, "Invalid ACAP ID");
		return;
	}
	if( !cgi || typeof cgi !== "string" || cgi.length === 0 ) {
		callback(true, "Invalid CGI");
		return;
	}

	var path = "/local/" + acapID + "/" + cgi;
	console.log(path);
	vapix.get( camera,path, function( error, response )	{
		if( error ) {
			callback( true, response );
			return;
		}
		if( response.search("Error") >= 0 ) {
			callback( true, response );
			return;
		}
		var json = null;
		if( typeof response === "string" && response.length )
			json = JSON.parse( response );
		if( json )
			response = json;
		callback( false, response );
	});
}

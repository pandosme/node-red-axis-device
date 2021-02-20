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

exports.Syslog2List = function( data ) {
	var list = [];
	var rows = data.split('\n');
	rows.forEach( function(line){
		line = line.trim();
		if( line.length > 30 ) {
			var part1 = line.split(']')[0];
			var part2 = line.substr(part1.length+2);
			var items1 = part1.split(' ');
			var items2 = part2.split(' ');
			var d = new Date(items1[0]);
			var date = d.getFullYear() + "-" + ("00" + (d.getMonth() + 1)).substr(-2,2) + "-" + ("00" + d.getDate()).substr(-2,2);
			var time = ("00" + d.getHours()).substr(-2,2) + ":" + ("00" + d.getMinutes()).substr(-2,2) + ":" + ("00" + d.getSeconds()).substr(-2,2);
			var log = {
				timestamp: d.getTime(),
				timestring: items1[0],
				date: date,
				time: time,
				severity: items1[3],
				service: items2[0].split('[')[0],
				message: items2[1]
			}
			if( log.severity === "INFO" )
				log.severity = "Info";
			if( log.severity === "ERR" )
				log.severity = "Error";
			if( log.severity === "WARNING" )
				log.severity = "Warning";
			for( var i = 1; i < items2.length; i++)
				log.message += " " + items2[i];
			if( log.severity !== "NOTICE" )
				list.push(log);
		}
	});
	return list;
}

exports.Location = function( data, callback ) {
	var parser = new xml2js.Parser({
		explicitArray: false,
		mergeAttrs: true
	});
		
	parser.parseString(data, function (err, result) {
		if( err ) {
			callback( "XML parse error", data);
			return;
		}
		if( !result.hasOwnProperty("PositionResponse") || !result.PositionResponse.hasOwnProperty("Success") ) {
			callback("Request error", result );
			return;
		}
		var location = {
			longitude: parseFloat(result.PositionResponse.Success.GetSuccess.Location.Lat),
			latitude: parseFloat(result.PositionResponse.Success.GetSuccess.Location.Lng),
			direction: parseFloat(result.PositionResponse.Success.GetSuccess.Location.Heading),
			text: result.PositionResponse.Success.GetSuccess.Text
		}
		callback( false, location );
	});
}

exports.SoapParser = function( data, callback ) {
	var parser = new xml2js.Parser({
		explicitArray: false,
		mergeAttrs: true
	});

	parser.parseString(data, function (err, result) {
		if( err ) {
			callback( err, results );
			return;
		}
		if( !result.hasOwnProperty('SOAP-ENV:Envelope') ) {
			callback( "Parse error", "Missing " +  'SOAP-ENV:Envelope' );
			return;
		}
		if( !result['SOAP-ENV:Envelope'].hasOwnProperty('SOAP-ENV:Body') ) {
			callback( "Parse error", "Missing " +  'SOAP-ENV:Body' );
			return;
		}
		callback( false, result['SOAP-ENV:Envelope']['SOAP-ENV:Body'] );
	});
}

exports.Certificate = function( data, callback ) {
	exports.SoapParser( data, function( error, response ) {	
		if( error ) {
			callback( error,response );
			return;
		}
		if( !response.hasOwnProperty("tds:GetCertificateInformationResponse") || !response["tds:GetCertificateInformationResponse"].hasOwnProperty("tds:CertificateInformation") ){
			callback("Invalid certificate", response );
			return;
		}
		var data = response['tds:GetCertificateInformationResponse']['tds:CertificateInformation'];
		var cert = {
			id: data['tt:CertificateID'],
			issuer: data['tt:IssuerDN'],
			subject: data['tt:SubjectDN'],
			validFrom: data['tt:Validity']['tt:From'],
			validTo: data['tt:Validity']['tt:Until'],
			keylength: data['tt:KeyLength'],
			serialnumber: data['tt:SerialNum'],
			pem: data['tt:Extension']['acert:CertificateInformationExtension']['acert:CertificatePEM']
		}
		callback( false, cert );
	});
}

exports.Certificates = function( data, callback ) {
	exports.SoapParser( data, function( error, response ) {	
		if( !response.hasOwnProperty('tds:GetCertificatesResponse') || !response['tds:GetCertificatesResponse'].hasOwnProperty('tds:NvtCertificate')) {
			callback("Parse error", response );
			return;
		}
			
		var NvtCertificate = response['tds:GetCertificatesResponse']['tds:NvtCertificate'];
		var certs = [];
		if( Array.isArray( NvtCertificate ) )
			certs = NvtCertificate;
		else
			certs.push(NvtCertificate);
		var list = [];
		certs.forEach( function( item ) {
			list.push({
				id: item["tt:CertificateID"],
				pem: item["tt:Certificate"]["tt:Data"]
			});
		});
		callback( false, list );
	});
}

exports.CSR_Request_Body = function( certificate, callback ) {
	if( !certificate  ) {
		callback( "Invalid input","No data");
		return;
	}
	if( !certificate.hasOwnProperty('id') ) {
		callback( "Invalid input","Missing id");
		return;
	}
	if( !certificate.hasOwnProperty('CN') ) {
		callback( "Invalid input","Missing CN");
		return;
	}
	var soapBody = '<acertificates:CreateCertificate2 xmlns="http://www.axis.com/vapix/ws/certificates">';
	soapBody += '<acertificates:Id>' + certificate.id + '</acertificates:Id> <acertificates:Subject>';
	soapBody +=	'<acert:CN>' + certificate.CN + '</acert:CN>';
	if( certificate.hasOwnProperty('C'))
		soapBody += '<acert:C>' + certificate.C + '</acert:C>';
	if( certificate.hasOwnProperty('O'))
		soapBody += '<acert:O>' + certificate.O + '</acert:O>';
	if( certificate.hasOwnProperty('OU'))
		soapBody += '<acert:OU>' + certificate.OU + '</acert:OU>';
	if( certificate.hasOwnProperty('ST'))
		soapBody += '<acert:ST>' + certificate.ST + '</acert:ST>';
	soapBody +=	'</acertificates:Subject></acertificates:CreateCertificate2>';
	callback( false, soapBody );
}

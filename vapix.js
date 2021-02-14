const fs = require("fs");
const xml2js = require('xml2js');
const got = require("got");
const digestAuth = require("@mreal/digest-auth");
const FormData = require("form-data");

var exports = module.exports = {};

function DigestClient( username, password ) {
	return got.extend({
		hooks:{
			afterResponse: [
				(res, retry) => {
					const options = res.request.options;
					const digestHeader = res.headers["www-authenticate"];
					if (!digestHeader){
						console.error("Camera Get: Response contains no digest header");
						return res;
					}
					const incomingDigest = digestAuth.ClientDigestAuth.analyze(	digestHeader );
					const digest = digestAuth.ClientDigestAuth.generateProtectionAuth( incomingDigest, username, password,{
						method: options.method,
						uri: options.url.pathname,
						counter: 1
					});
					options.headers.authorization = digest.raw;
					return retry(options);
				}
			]
		}
	});
}

exports.get = function( camera, path, callback ) {
	(async () => {
		try {
			const client = DigestClient( camera.user, camera.password);
			const response = await client.get( camera.url + path,{
				https:{rejectUnauthorized: false}
			});
			callback(false, response.body );
		} catch (error) {
			console.log("HTTP GET Error:", error);
			callback(true, error );
		}
	})();
}

exports.postJSON = function( camera, path, body, callback ) {
	var json = body;
	if( typeof body === 'string' )
		json = JSON.parse( body );
	(async () => {
		try {
			const client = DigestClient( camera.user, camera.password );
			const response = await client.post( camera.url + path, {
				json: json,
				https: {rejectUnauthorized: false},
				 responseType: 'json'
			});
			callback(false, response.body );
		} catch (error) {
			console.log("Post JSON Error:",error);
			callback(true, error );
		}
	})();
}

exports.postBody = function( camera, path, body, callback ) {
	(async () => {
		try {
			const client = DigestClient( camera.user, camera.password );
			const response = await client.post( camera.url + path, {
				body: body,
				https: {rejectUnauthorized: false}
			});
			callback(false, response.body );
		} catch (error) {
			console.log("postBody error:" ,error);
			callback(true, error );
		}
	})();
}

exports.image = function( camera, mediaProfil, callback ) {
	path = '/axis-cgi/jpg/image.cgi';
	if( mediaProfil && mediaProfil.length > 3 )
		path += '?' + mediaProfil;
	(async () => {
		try {
			const client = DigestClient( camera.user, camera.password);
			const response = await client.get( camera.url + path,{responseType:"buffer",https:{rejectUnauthorized: false}});
			callback(false, response.body );
		} catch (error) {
			callback(true, error );
		}
	})();
}

exports.getParam = function( camera, paramPath, callback ) {
	if( !paramPath || paramPath.length === 0 || paramPath.toLowerCase ( ) === "root" ) {
		callback(true,"Invalid parameter path.  Set data to a valid parameter group" );
		return;
	}
	exports.get( camera, '/axis-cgi/param.cgi?action=list&group=' + paramPath, function( error, body ) {
		if( error ) {
			callback( true, error );
			return;
		}
		if( body.search("Error") >= 0 ) {
			callback( true, body);
			return;
		}
		var params = ParseVapixParameter(body);
		callback( false, params );
	});
}

function ParseVapixParameter( data ) {
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

exports.setParam = function( camera, group, parameters, callback ) {
	if( !group || group.length == 0 ) {
		callback( true, "Undefined property group");
		return;
	}

	if( !parameters || !(typeof parameters === 'object') ) {
		callback( true, "Input is not a valid object");
		return;
	}
	var path = '/axis-cgi/param.cgi?action=update';
	for( var parameter in parameters ) {
		var value = parameters[parameter];
		if( value === true )
			value = 'yes';
		if( value === false )
			value = 'no'
		if(  typeof parameters[parameter] === 'object' ) {
			//Don't update sub groups 
		} else {
			path += '&root.' + group + '.' + parameter + '=' + encodeURIComponent(value);
		}
	}
	
	exports.get( camera, path, function( error, body ) {
		if( error ) {
			callback( true, error );
			return;
		}
		if( body.search("Error") >= 0 ) {
			callback( true, body);
			return;
		}
		callback( false, body );
	});
}


exports.removeAccount = function( camera, accountName, callback ) {
	var path  = "/axis-cgi/pwdgrp.cgi?action=remove&user=" + accountName;
	exports.get( camera, path, function( error, response ) {
		if( error ) {
			callback(true, response );
			return;
		}
		if( response.search("Error") >= 0 ) {
			callback( true, "Unable to remove account");
			return;
		}
		callback(false,"OK");
	});
}

exports.mqttClientStatus = function( camera, callback ) {
	var json = {
		apiVersion: "1.0",
		context: "Node-Red",
		method: "getClientStatus"
	};
	exports.postJSON( camera, "/axis-cgi/mqtt/client.cgi", json, function(error, response) {
		if( error ) {
			callback( true, response );
			return;
		}
		
		var client = response.data;
		var processedClient = {
			active: client.status.state === "active",
			status: client.status.connectionStatus, //connected, connecting, failed, disconnected
			connected: client.status.connectionStatus === "connected",
			host: client.config.server.host,
			port: client.config.server.port.toString(),
			id: client.config.clientId,
			tls: client.config.server.protocol === "ssl",
			validateCertificate: client.config.ssl.validateServerCert,
			user: client.config.username,
			password: '********',
			lastWillTestament: null,
			announcement: null
		}
		if( client.config.hasOwnProperty("lastWillTestament") ) {
			if( client.config.lastWillTestament.useDefault ) {
				processedClient.lastWillTestament = {
					topic: "default",
					payload: "default"
				}
			} else {
				processedClient.lastWillTestament = {
					topic: client.config.lastWillTestament.topic,
					payload: JSON.parse(client.config.lastWillTestament.message)
				}
			}
		}
		if( client.config.hasOwnProperty("connectMessage") ) {
			if( client.config.connectMessage.useDefault ) {
				processedClient.announcement = {
					topic: "default",
					payload: "default"
				}
			} else {
				processedClient.announcement = {
					topic: client.config.connectMessage.topic,
					payload: JSON.parse(client.config.connectMessage.message)
				}
			}
		}
		callback(false, processedClient );
	});
}


exports.mqttConnect = function( camera, settings, callback ) {
	if( settings === null || settings === false ) {  //Disconnect request
		exports.postJSON( camera, "/axis-cgi/mqtt/client.cgi",
			{
				apiVersion: "1.0",
				context: "Node-Red",
				method: "deactivateClient"
			},
			function(error, response) {
				if( error ) {
					callback( true, response );
					return;
				}
				callback( false, "MQTT Client deactivated");
			}
		);
		return;
	}
	
					
	if( !settings.hasOwnProperty("host") || settings.host.length === 0 ) {
		callback( true, "Invalid host");
		return;
	}

	if( !settings.hasOwnProperty("port") || settings.port.length === 0 ) {
		callback( true, "Invalid port");
		return;
	}
					
	if( !settings.hasOwnProperty("id") || settings.id.length === 0 ) {
		callback( true, "Invalid client ID");
		return;
	}
	var user = "";
	var password = "";
	var tls = false;
	var validateCertificate = false;

	if( settings.hasOwnProperty("tls") )
		tls = settings.tls;

	if( settings.hasOwnProperty("validateCertificate")  )
		validateCertificate = settings.validateCertificate;

	var params = {
		activateOnReboot: true,
		server: {
			protocol: tls?"ssl":"tcp",
			host: settings.host,
			port: parseInt(settings.port),
			//"basepath":"url-extension"
		},
		ssl: {
			validateServerCert: validateCertificate
		},
		username: settings.user || "",
		password: settings.password || "",
		clientId: settings.id,
		keepAliveInterval: 60,
		connectTimeout: 60,	
		cleanSession: true,
		autoReconnect: true
	}
					
	if( settings.hasOwnProperty("lastWillTestament") && settings.lastWillTestament !== null && settings.lastWillTestament !== false ) {
		params.lastWillTestament = {
			useDefault: false,
			topic: settings.lastWillTestament.topic,
			message: settings.lastWillTestament.payload,
			retain: true,
			qos: 1							
		}
		//console.log(settings.lastWillTestament.payload);
		if( typeof settings.lastWillTestament.payload === 'object' )
			params.lastWillTestament.message = JSON.stringify(settings.lastWillTestament.payload);
		params.disconnectMessage = JSON.parse(JSON.stringify(params.lastWillTestament));
	}
	
	if( settings.hasOwnProperty("announcement") && settings.announcement !== null && settings.announcement !== false ) {
		params.connectMessage = {
			useDefault: false,
			topic: settings.announcement.topic,
			message: settings.announcement.payload,
			retain: true,
			qos: 1							
		}
		if( typeof settings.announcement.payload === 'object' )
			params.connectMessage.message = JSON.stringify(settings.announcement.payload);
	}
	
	exports.postJSON( camera, "/axis-cgi/mqtt/client.cgi",
		{
			apiVersion: "1.0",
			context: "Node-Red",
			method: "configureClient",
			params: params
		},
		function(error, response) {
			if( error ) { callback( true, response ); return; }
			exports.postJSON( camera, "/axis-cgi/mqtt/client.cgi",
				{
					apiVersion: "1.0",
					context: "Node-Red",
					method: "activateClient"
				},
				function(error, response) {
					if( error ) { callback( true, response ); return; }
					callback( false, "MQTT configured");
				}
			);
		}
	);
}

exports.mqttGetPublishing = function( camera, callback ) {
	exports.postJSON( camera, "/axis-cgi/mqtt/event.cgi",
		{
			apiVersion: "1.0",
			context: "Node-Red",
			method: "getEventPublicationConfig"
		},
		function(error, response) {
			if( error ) {
				callback( true, response );
				return;
			}
			var events = response.data.eventPublicationConfig.eventFilterList;
			var list = [];
			events.forEach( function( onvifEvent ) {
				list.push({
					event: onvifEvent.topicFilter,
					retain: (onvifEvent.reatin === "property" || onvifEvent.reatin === "all")?true:false
				});
			});

			var data = response.data.eventPublicationConfig;
			var processedResponse = {
				topic: data.customTopicPrefix,
				onvif: data.appendEventTopic,
				events: list
			}
			callback( false, processedResponse);
		}
	);
}

exports.mqttSetPublishing = function( camera, settings, callback ) {
	if( !settings.hasOwnProperty("topic") ) {
		msg.error = true;
		msg.payload = "Topic needs to be set";
		node.send(msg);
		return;
	}
	if( !settings.hasOwnProperty("events") ) {
		msg.error = true;
		msg.payload = "Events needs to be set";
		node.send(msg);
		return;
	}
	if( !Array.isArray(settings.events) )
		settings.events = [];
	var list = [];
	for( var i = 0; i < settings.events.length; i++ ) {
		list.push( {
			topicFilter: settings.events[i].event,
			qos: 0,
			retain: settings.events[i].retain ? "all":"none"
		});
	}
	params = {
		eventFilterList:list,
		topicPrefix: "custom",
		customTopicPrefix: settings.topic,
		appendEventTopic: settings.onvif || false,
		includeTopicNamespaces : false,
		includeSerialNumberInPayload: true
	};
	console.log(params);
	exports.postJSON( camera, "/axis-cgi/mqtt/event.cgi",
		{
			apiVersion: "1.0",
			context: "Node-Red",
			method: "configureEventPublication",
			params:params
		},
		function(error, response) {
			if( error ) {
				callback( true, response );
				return;
			}
			callback( false, "OK" );
				return;
		}
	);
}

/*
function Digest_ACAP_Form_Upload(filePath, username, password) {
	return got.extend({
		hooks:{
			afterResponse: [
				(res, retry) => {
					const options = res.request.options;
					const digestHeader = res.headers["www-authenticate"];
					if (!digestHeader){
						console.error("Firmware update: Response contains no digest header");
						return res;
					}
					const incomingDigest = digestAuth.ClientDigestAuth.analyze(	digestHeader );
					const digest = digestAuth.ClientDigestAuth.generateProtectionAuth( incomingDigest, username, password,{
						method: options.method,
						uri: options.url.pathname,
						counter: 1
					});
					const form = new FormData();
					form.append(
						"data",
						'{"apiVersion": "1.0", "context": "nodered", "method": "install"}',
						{
							filename: "blob",
							contentType: "application/json",
						}
					);
					form.append(
						"fileData",
						fs.createReadStream(filePath),
						{
							filename: 'acap.eap',
							contentType: "application/octet-stream"
						}
					);
					options.headers = form.getHeaders();
					options.headers.authorization = digest.raw;
					options.body = form;
					return retry(options);
				}
			]
		}
	});
}

exports.installACAP = function( camera, filepath, callback ) {
	(async () => {
		try {
			const client = Digest_ACAP_Form_Upload( filepath, camera.user, camera.password);
			const url = camera.url + '/axis-cgi/packagemanager.cgi';
			const response = await client.post(url);
			var json = JSON.parse( response.body );
			if( json.hasOwnProperty("error") )
				callback(true, json.error );
			else
				callback(false, json.data );
		} catch (error) {
			console.log(error);
			callback(true, error );
		}
	})();	
}

*/

exports.listConnections = function( camera, callback ) {
	exports.get( camera, '/axis-cgi/admin/connection_list.cgi?action=get', function(error, response) {
		if( error ) {
			callback( true, response );
			return;
		}
		var rows = response.split('\n');
		var list = [];
		for( var i = 1; i < rows.length; i++) {
			var row = rows[i].trim();
			row = row.replace(/\s{2,}/g, ' ');
			if( row.length > 10 ) {
				var items = row.split(' ');
				var ip = items[0].split('.');
				if( ip != '127' ) {
					list.push({
						address: items[0],
						protocol: items[1],
						port: items[2],
						service: items[3].split('/')[1]
					})
				}
			}
		}
		callback( false, list );
	});
}

exports.restart = function( camera, callback ) {
	exports.get( camera, '/axis-cgi/admin/connection_list.cgi?action=get', function(error, response) {
		if( error ) {
			callback( true, response );
			return;
		}
		callback( false, "Device Restarted" );
	});
}


/*
	File Data can be a absolut filepath to a firmware file or
	a data buffer;
*/

function parseSOAPResponse( xml, success, failure ) {
	var parser = new xml2js.Parser({
		explicitArray: false,
		mergeAttrs: true
	});

	parser.parseString(xml, function (err, result) {
		if( err ) {
			failure( err );
			return;
		}
		if( !result.hasOwnProperty('SOAP-ENV:Envelope') ) {
			failure( "Parse error.  Missing " +  'SOAP-ENV:Envelope' );
			return;
		}
		if( !result['SOAP-ENV:Envelope'].hasOwnProperty('SOAP-ENV:Body') ) {
			failure( "Parse error: Missing " +  'SOAP-ENV:Body' );
			return;
		}
		success( result['SOAP-ENV:Envelope']['SOAP-ENV:Body'] );
	});
}

exports.soap = function( camera, soapBody, callback ) {
	var soapEnvelope = '<SOAP-ENV:Envelope ' +
					   'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '+
					   'xmlns:xsd="http://www.w3.org/2001/XMLSchema" '+
					   'xmlns:tt="http://www.onvif.org/ver10/schema "'+
					   'xmlns:tds="http://www.onvif.org/ver10/device/wsdl" '+
					   'xmlns:tev="http://www.onvif.org/ver10/event/wsdl" '+
					   'xmlns:tns1="http://www.onvif.org/ver10/topics" ' +
	                   'xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" '+
					   'xmlns:acertificates="http://www.axis.com/vapix/ws/certificates" '+
					   'xmlns:acert="http://www.axis.com/vapix/ws/cert" '+
					   'xmlns:aev="http://www.axis.com/vapix/ws/event1" ' +
					   'xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope">';
					   
	soapEnvelope += '<SOAP-ENV:Body>' + soapBody + '</SOAP-ENV:Body>';
	soapEnvelope += '</SOAP-ENV:Envelope>';
	exports.postBody( camera, '/vapix/services', soapEnvelope, function( error, response) {
		if( error ) {
			callback( true, response );
			return;
		}
		parseSOAPResponse( response,
			function(result){ //success
				callback(false,result);
			},
			function(result) {
				callback(true,result);
			}
		)
	});
}

exports.infoCertificate = function( camera, certificateID, callback ) {
	var soapBody = '<tds:GetCertificateInformation xmlns="http://www.onvif.org/ver10/device/wsdl">';
	soapBody += '<CertificateID>' + certificateID + '</CertificateID>';
	soapBody += '</tds:GetCertificateInformation>';
	
	exports.soap( camera, soapBody, function( error, response ) {
		if( error ) {
			console.log("infoCertificate:",response);
			callback( true, response);
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
			certPEM: data['tt:Extension']['acert:CertificateInformationExtension']['acert:CertificatePEM']
		}
		callback( false, cert );
	});
};

exports.listCertificates = function( camera, callback ) {
	var soapBody = '<tds:GetCertificates xmlns="http://www.onvif.org/ver10/device/wsdl"></tds:GetCertificates>';
	exports.soap( camera, soapBody, function( error, response ) {
		if( error ) {
			callback( true,response);
			return;
		}
		if( response.hasOwnProperty('tds:GetCertificatesResponse') && response['tds:GetCertificatesResponse'].hasOwnProperty('tds:NvtCertificate')) {
			var NvtCertificate = response['tds:GetCertificatesResponse']['tds:NvtCertificate'];
			var certs = [];
			if( Array.isArray( NvtCertificate ) )
				certs = NvtCertificate;
			else
				certs.push(NvtCertificate);
			console.log("Found " + certs.length + " certs");
			var list = [];
			if( certs.length === 0 ) {
				callback( false, list );
				return;
			}
			var certCounter = certs.length;
			var theCallback = callback;
			for( var i = 0; i < certs.length; i++ ) {
				exports.infoCertificate( camera, certs[i]['tt:CertificateID'], function( error, response ) {
					if( !error )
						list.push( response );

					certCounter--;
					if( certCounter <= 0 )
						theCallback( false, list );
				});
			};
			return;
		}
		callback(true,"Invalid SOAP response. Missing tds:GetCertificatesResponse");
	});
};

exports.createCertificate = function( camera, id, certificate, callback ) {
	if( id.length < 4 ) {
		callback( true,"Invalid certificate id");
		return;
	}
	if( !certificate || !certificate.hasOwnProperty('commonName') ) {
		callback( true,"Invalid Connon Name");
		return;
	}
	var soapBody = '<acertificates:CreateCertificate2 xmlns="http://www.axis.com/vapix/ws/certificates">';
	soapBody += '<acertificates:Id>' + id + '</acertificates:Id> <acertificates:Subject>';
	soapBody +=	'<acert:CN>' + certificate.commonName + '</acert:CN>';
	if( certificate.hasOwnProperty('country'))
		soapBody += '<acert:C>' + certificate.country + '</acert:C>';
	if( certificate.hasOwnProperty('organizationName'))
		soapBody += '<acert:O>' + certificate.organizationName + '</acert:O>';
	if( certificate.hasOwnProperty('organizationalUnitName'))
		soapBody += '<acert:OU>' + certificate.organizationalUnitName + '</acert:OU>';
	if( certificate.hasOwnProperty('stateOrProvinceName'))
		soapBody += '<acert:ST>' + certificate.stateOrProvinceName + '</acert:ST>';
	soapBody +=	'</acertificates:Subject></acertificates:CreateCertificate2>';
	exports.soap( camera, soapBody, function( error, response ) {
		if( error ) {
			callback( true, response);
			return;
		}
		if( response.hasOwnProperty('acertificates:CreateCertificate2Response') && response['acertificates:CreateCertificate2Response'].hasOwnProperty('acertificates:Certificate') ) {
			var PEM_Data = response['acertificates:CreateCertificate2Response']['acertificates:Certificate'];
			var rows = PEM_Data.match(/.{1,64}/g);
			var pem = '----BEGIN CERTIFICATE-----\n';
			rows.forEach(function(row){
				pem += row + '\n'
			});
			pem += '-----END CERTIFICATE-----\n';
			callback( false, pem );
		} else {
			callback( true, "Unable to parse Certificate PEM from response" );
		}
	});
}

exports.requestCSR = function( camera, id, certificate, callback ) {
	if( id.length < 4 ) {
		callback( true,"Invalid certificate id");
		return;
	}
	if( !certificate || !certificate.hasOwnProperty('commonName') ) {
		callback( true,"Invalid Common Name");
		return;
	}
	var soapBody = '<acertificates:GetPkcs10Request2 xmlns="http://www.axis.com/vapix/ws/certificates">';
	soapBody += '<acertificates:Id>' + id + '</acertificates:Id> <acertificates:Subject>';
	soapBody +=	'<acert:CN>' + certificate.commonName + '</acert:CN>';
	if( certificate.hasOwnProperty('country')) soapBody += '<acert:C>' + certificate.country + '</acert:C>';
	if( certificate.hasOwnProperty('organizationName')) soapBody += '<acert:O>' + certificate.organizationName + '</acert:O>';
	if( certificate.hasOwnProperty('organizationalUnitName')) soapBody += '<acert:OU>' + certificate.organizationalUnitName + '</acert:OU>';
	if( certificate.hasOwnProperty('stateOrProvinceName')) soapBody += '<acert:ST>' + certificate.stateOrProvinceName + '</acert:ST>';
	soapBody +=	'</acertificates:Subject></acertificates:Subject></acertificates:GetPkcs10Request2>';
	exports.soap( camera, soapBody, function( error, response ) {
		if( error ) {
			callback( true, response);
			return;
		}
		if( response.hasOwnProperty('acertificates:GetPkcs10Request2Response') && response['acertificates:GetPkcs10Request2Response'].hasOwnProperty('acertificates:Pkcs10Request') ) {
			var PEM_Data = response['acertificates:GetPkcs10Request2Response']['acertificates:Pkcs10Request'];
			var rows = PEM_Data.match(/.{1,64}/g);
			var pem = '-----BEGIN CERTIFICATE REQUEST-----\n';
			rows.forEach(function(row){
				pem += row + '\n'
			});
			pem += '-----END CERTIFICATE REQUEST-----\n';
			callback( false, pem );
		} else {
			callback( true, "Unable to parse Certificate PEM from response" );
		}
	});
}

exports.listEvents = function( camera, callback ) {
	var soapBody = '<aev:GetEventInstances xmlns="http://www.axis.com/vapix/ws/event1"></aev:GetEventInstances>';
	exports.soap( camera, soapBody, function(error, response ) {
		if( error ) {
			callback( true, response);
			return;
		}
		if( !response.hasOwnProperty('aev:GetEventInstancesResponse') ) {
			callback(true, "Soap parse error" );
			return;
		}
		var events = ParseEvents( null, null, null,response['aev:GetEventInstancesResponse']['wstop:TopicSet'] ).children;
		list = [];
		var acap = {
			topic: "acap",
			name: "ACAP",
			group:"",
			stateful: false,
			filter: "",
			children: []
		}
		list.push(acap)
		for(var i = 0; i < events.length; i++ ) {
			var add = true;
			if( events[i].topic === "tns1:UserAlarm") {
				list = list.concat(events[i].children[0].children);
				add = false;
			}
			if( events[i].topic === "tns1:Device") {
				list = list.concat(events[i].children[0].children);
				add = false;
			}
			if( events[i].topic === "tns1:RuleEngine") {
				acap.children = acap.children.concat(events[i].children);
				add = false;
			}
			if( events[i].topic === "tnsaxis:CameraApplicationPlatform") {
				acap.children = acap.children.concat(events[i].children);
				add = false;
			}
			if( add )
				list.push(events[i]);
		}
		callback(null, list );
	});
}


function ParseEvents( topic, group, name, event ) {
    if( event.hasOwnProperty('isApplicationData') )
        return null;
    if( topic === "tns1:Device/tnsaxis:SystemMessage")
        return null;
    if( topic === "tns1:Device/tnsaxis:Light")
        return null;
    if( topic === "tns1:Device/tnsaxis:Network")
        return null;
    if( topic === "tns1:Device/tnsaxis:HardwareFailure")
        return null;
    if( topic === "tns1:Device/tnsaxis:Status/SystemReady")
        return null;
    if( topic === "tns1:Device/tnsaxis:IO/VirtualInput")
        return null;
    if( topic === "tnsaxis:Storage/RecorderStatus")
        return null;
    var item = {
        topic: topic? topic:"",
        name: name? name:"",
        group: group? group:"",
        stateful: false,
        filter:"",
        children: []
    }
    var parentTopic = topic? topic+"/":"";
    if( event.hasOwnProperty('aev:NiceName') ) {
        switch( event['aev:NiceName'] ) {
            case 'PTZController': item.name = "PTZ"; break;
            case 'Day night vision': item.name = "Daytime"; break;
            case 'Recurring pulse': item.name = "Timer"; item.group="Timer";break;
            case 'Scheduled event': item.name = "Schedule"; item.group="Schedule";break;
            case 'Virtual Input': item.name = "Virtual Inport"; item.group="Virtual Inport";break;
            case 'Manual trigger': item.name = "User Button"; item.group="User Button";break;
            case 'Digital input port': item.name = "Digital Input"; item.group="Digital Input";break;
            case 'Video source': item.name = "Detectors"; item.group="Detectors";break;
            default: item.name = event['aev:NiceName'];
        }
        delete event['aev:NiceName'];
    }
    if( event.hasOwnProperty('wstop:topic') ) {
        delete event['wstop:topic'];
    }
    for( var property in event ) {
        if( typeof event[property] === 'object' ) {
            if( property === "aev:MessageInstance") {
                sources = [];
                sourceType = null;
                sourceName = null;
                if( event[property].hasOwnProperty('aev:SourceInstance') ) {
                    var source = event[property]['aev:SourceInstance']['aev:SimpleItemInstance'];
                    if( source.hasOwnProperty('aev:Value') && source['aev:Value'].length > 1 ) {
                        sourceType = source.Type;
                        sourceName = source.Name;
                        sources = source['aev:Value'];
                    }
                }
                var stateful = false;
                if( event[property].hasOwnProperty('aev:DataInstance') ) {
                    var data = event[property]['aev:DataInstance']['aev:SimpleItemInstance'];
                    if( data.Type === 'xsd:boolean' )
                        stateful = data.Name;
                }
                if( sources.length ) {
                    for( var i = 0; i < sources.length; i++ ) {
                        var sourceEvent = {
                            topic: item.topic,
                            name: item.group+'/'+ sources[i].hasOwnProperty('aev:NiceName')? sources[i]['aev:NiceName']:sources[i]['_'],
                            group: item.group,
                            stateful: (stateful !== false),
                            filter:'boolean(//SimpleItem[@Name="' + sourceName + '" and @Value="' + sources[i]['_'] + '"])',
                            children: []
                        }
                        if( stateful ) {
                            sourceEvent.children.push({
                                topic: sourceEvent.topic,
                                name: sourceEvent.name + ":True",
                                group: sourceEvent.group,
                                stateful: true,
								stateName: stateful,
								stateValue: 1,
                                filter: sourceEvent.filter + ' and boolean(//SimpleItem[@Name="' + stateful + '" and @Value="1"])',
                                children: []
                            })                    
                            sourceEvent.children.push({
                                topic: sourceEvent.topic,
                                name: sourceEvent.name + ":False",
                                group: sourceEvent.group,
                                stateful: true,
								stateName: stateful,
								stateValue: 0,
                                filter: sourceEvent.filter + ' and boolean(//SimpleItem[@Name="' + stateful + '" and @Value="0"])',
                                children: []
                            })                    
                        }
                        item.children.push(sourceEvent);
                    }
                } else {
                    if( stateful ) {
                        item.children.push({
                            topic: item.topic,
                            name: item.name + ":True",
                            group: item.group,
                            stateful: true,
							stateName: stateful,
							stateValue: 1,
                            filter:'boolean(//SimpleItem[@Name="' + stateful + '" and @Value="1"])',
                            children: []
                        })                    
                        item.children.push({
                            topic: item.topic,
                            name: item.name + ":False",
                            group: item.group,
                            stateful: true,
							stateName: stateful,
							stateValue: 0,
                            filter:'boolean(//SimpleItem[@Name="' + stateful + '" and @Value="0"])',
                            children: []
                        })                    
                    }
                }
            } else {
                if( property != "tns1:LightControl" &&
                    property != "tns1:Media" &&
                    property !=  "tns1:RecordingConfig"
                ) {
                    child = ParseEvents( parentTopic + property, item.name, name, event[property] );
                    if( child )
                        item.children.push( child );
                }
            }
        }  else {
            item[property] = event[property];
        }
    }
    return item;    
}

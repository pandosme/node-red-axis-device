const xml2js = require('xml2js');
const got = require("got");
const digestAuth = require("@mreal/digest-auth");
const FormData = require("form-data");

var exports = module.exports = {};

exports.get = function( device, path, resonseType, callback ) {
	var client = got.extend({
		hooks:{
			afterResponse: [
				(res, retry) => {
					const options = res.request.options;
					const digestHeader = res.headers["www-authenticate"];
					if (!digestHeader){
						console.error("Response contains no digest header");
						return res;
					}
					const incomingDigest = digestAuth.ClientDigestAuth.analyze(	digestHeader );
					const digest = digestAuth.ClientDigestAuth.generateProtectionAuth( incomingDigest, device.user, device.password,{
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
	
	(async () => {
		try {
			const response = await client.get( device.url+path,{
				responseType: resonseType,
				https:{rejectUnauthorized: false}
			});
			callback(false, response.body );
		} catch (error) {
			callback(error, error );
		}
	})();

}

exports.post = function( device, path, body, callback ) {
	var client = got.extend({
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
					const digest = digestAuth.ClientDigestAuth.generateProtectionAuth( incomingDigest, device.user, device.password,{
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

	var json = null;
	if( typeof body === "object" )
		json = body;
	if( typeof body === "string" && body[0] !== "<")
		json = JSON.parse( body );

	(async () => {
		try {
			var response = null;
			if( json )
				response = await client.post( device.url+path, {
					json: json,
					responseType: 'json',
					https: {rejectUnauthorized: false}
				});
			else
				response = await client.post( device.url+path, {
					body: body,
					https: {rejectUnauthorized: false}
				});
			callback(false, response.body );
		} catch (error) {
			callback(error, error  );
		}
	})();
}

exports.Soap = function( device, body, callback ) {
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
					   
	soapEnvelope += '<SOAP-ENV:Body>' + body + '</SOAP-ENV:Body>';
	soapEnvelope += '</SOAP-ENV:Envelope>';
	exports.post( device, '/vapix/services', soapEnvelope, function( error, response) {
		callback(error,response);
	});
}

exports.upload = function( device, type, filename, options, buffer, callback ) {

	if(!buffer) {
		callback(true,"Invalid upload buffer");
		return;
	}

	if( !filename || typeof filename !== "string" || filename.length === 0 ) {
		callback(true,"Invalid file path");
		return;
	}

	if( !device.user || typeof device.user !== "string" || device.user.length === 0 ) {
		callback(true,"Invalid user name");
		return;
	}

	if( !device.password || typeof device.password !== "string" || device.password.length === 0 ) {
		callback(true,"Invalid password");
		return;
	}

	var formData = {
		apiVersion: "1.0",
		method: "uploadOverlayImage",
		params:{
			scaleToResolution:true
		}
	};


	var formData = {
		apiVersion: "1.0",
		context: "nodered",
		method: "upgrade"
	}
	var url = null;
	var part1 = null;
	var part2 = null;
	var contenttype = "application/octet-stream";
		
	switch( type ) {
		case "firmware":
			url =  device.url + '/axis-cgi/firmwaremanagement.cgi';
			part1 = "data";
			part2 = "fileData";
			formData.method = "upgrade";
			contenttype = "application/octet-stream";
		break;
		case "acap":
			url = device.url + "/axis-cgi/packagemanager.cgi";
			part1 = "data";
			part2 = "fileData";
			formData.method = "install";
			contenttype = "application/octet-stream";
		break;
		case "overlay":
			url =  device.url + '/axis-cgi/uploadoverlayimage.cgi';
			part1 = "json";
			part2 = "image";
			formData.method = "uploadOverlayImage";
			formData.params = {
				scaleToResolution:true
			}
			if( options && options.hasOwnProperty("scale") && options.scale )
				formData.params.scaleToResolution = options.scale;
			if( options && options.hasOwnProperty("alpha")  )
				formData.params.alpha = options.alpha;			
			contenttype = "image/" + filename.split(".")[1];
		break;
		default:
			callback(true,"Invalidy upload type");
			return;
	}

	var formJSON = JSON.stringify(formData);
	
	var client = got.extend({
		hooks:{
			afterResponse: [
				(res, retry) => {
					const options = res.request.options;
					const digestHeader = res.headers["www-authenticate"];
					if (!digestHeader){
						console.error("Response contains no digest header");
						return res;
					}
					const incomingDigest = digestAuth.ClientDigestAuth.analyze(	digestHeader );
					const digest = digestAuth.ClientDigestAuth.generateProtectionAuth( incomingDigest, device.user, device.password,{
						method: options.method,
						uri: options.url.pathname,
						counter: 1
					});
					
					const form = new FormData();
					form.append(
						part1,
						formJSON,
						{
							filename: "blob",
							contentType: "application/json",
						}
					);
					form.append(
						part2,
						buffer,
						{
							filename: filename,
							contentType: contenttype
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

	(async () => {
		try {
			const response = await client.post(url);
			json = JSON.parse( response.body );
			if( json && json.hasOwnProperty("error") ) {
				callback("Upload failed", json.error );
				return;
			}
			callback(false, response.body );
		} catch (error) {
			callback(error, error);
		}
	})();
}


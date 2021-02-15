const xml2js = require('xml2js');
const got = require("got");
const digestAuth = require("@mreal/digest-auth");
const FormData = require("form-data");

var exports = module.exports = {};

exports.get = function( device, path, callback ) {
//	console.log("AxisDigest.get", device, path );

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
	
	(async () => {
		try {
			const response = await client.get( device.url+path,{https:{rejectUnauthorized: false} });
			callback(false, response.body );
		} catch (error) {
			console.log("HTTP GET Error:", error);
			callback(error, response.body );
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
	if( typeof body === "string" )
		json = json = JSON.parse( body );

/*
	console.log("AxisDigest.Post", {
		device:device,
		path: path,
		json: json,
		body: body
	});
*/

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
//			console.log("AxisDigest Response", response.body);
			callback(false, response.body );
		} catch (error) {
			console.log("Axis Digest Post" ,error, response.body);
			callback(error, response.body  );
		}
	})();
}

exports.upload = function( device, type, filename, buffer, callback ) {
	console.log("AxisDigest.upload", type, filename );

	if(!buffer) {
		callback(true,"Invalid upload buffer");
		return;
	}

	if( !filename || typeof filename !== "string" || filename.length === 0 ) {
		callback(true,"Invalid file path");
		return;
	}

	if( !user || typeof user !== "string" || user.length === 0 ) {
		callback(true,"Invalid user name");
		return;
	}

	if( !password || typeof password !== "string" || password.length === 0 ) {
		callback(true,"Invalid password");
		return;
	}

	if( !url || typeof url !== "string" || url.length === 0 ) {
		callback(true,"Invalid upload url");
		return;
	}
	

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
			url =  device.url + '/axis-cgi/uploadoverlayimage.cgi';
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
						console.error("Firmware update: Response contains no digest header");
						return res;
					}
					const incomingDigest = digestAuth.ClientDigestAuth.analyze(	digestHeader );
					const digest = digestAuth.ClientDigestAuth.generateProtectionAuth( incomingDigest, camera.user, camera.password,{
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
			console.log(response.body);
			callback(false, response.body );
		} catch (error) {
			console.log(error);
			console.log(response);
			callback(error, response.body);
		}
	})();

}


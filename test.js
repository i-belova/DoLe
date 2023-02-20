/**
 * Created by Halck on 15.08.2018.
 */
var http = require('http');
var port = 8881;

var body = JSON.stringify({
    'query': 'боль в голове'
})

var request = new http.ClientRequest({
    hostname: "127.0.0.0",
    port: port,
    path: "/scnlp/getsymptom",
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
    }
})

request.end(body);

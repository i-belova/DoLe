/**
 * Created by Halck on 11.05.2018.
 */

var url = require('url');
var https = require('https');
var SocksProxyAgent = require('socks-proxy-agent');
var encoder = require('iconv-lite');
var config = require('./config.json');
const EventEmitter = require('events');

class reqEmitter extends EventEmitter {};

var proxy =  "";
var TOKEN = config.test ? config.test_token : config.token;
var lastOffset = 1000;


var agent;

var getAgent = function() {
    if ((config.proxy!=undefined)&&(config.proxy!=null)&&(config.proxy.length != 0)) {
        proxy =  'socks://' + config.proxy[2];
        agent = new SocksProxyAgent(proxy, true);
        console.log("http_module::getAgent:: working on socks proxy " + proxy);
    } else {
        agent = new https.Agent({keepAlive: true});
        console.log("http_module::getAgent:: working without proxy");
    }
}

var init = function () {
    getAgent();
}

var request = function(curl, timeout, callback) {

    if ((timeout == undefined)||(timeout = 0)) {
        timeout = config.request_timeout;
    }

    var resultEmitter = new reqEmitter();

    var opts = url.parse(curl);
    opts.agent = agent;

    setTimeout(function () {
        console.log("http_module::req:: Time to answer exceeded");
        resultEmitter.emit('err', 'Time exceeded');
    }, timeout);

    let req = https.get(opts, function (res) {
        var body = '';

        res.on('data', function (chunk) {
            body+=chunk
        });

        res.on('end', function (){
            resultEmitter.emit('end', body);
            if (callback != undefined) {
                callback();
            }
        });

    });

    req.on('error', function (e) {
        console.log("http_module::req:: Error during request");
    });

    return resultEmitter;
};

update = function () {

    var result = new reqEmitter();

    var endpoint = process.argv[2] || 'https://api.telegram.org/bot' + TOKEN + '/getUpdates' + "?offset=" + lastOffset;

    req = request(endpoint);

    req.on ('end', function (data) {
        result.emit('end', data);
    });

    req.on('error', function (e) {
        console.log(e);
    });

    return result;
}

updateEternal = function (curl) {
}

module.exports.request = request;
module.exports.update = update;
module.exports.updatesEternal = updateEternal;
module.exports.init = init;
/**
 * Created by Halck on 21.06.2018.
 */

const spawn = require("child_process");
var fs = require('fs');
var util = require('util');
var dateFormat = require('dateformat');
var encoder = require('iconv-lite');

var file_name = "logs-%s.txt";
var file_number = 0;
var buffer = "";
var file_size = 0;

var command_stirng = "node";

var writeBuffer = function (date) {
    buffer = encoder.encode(buffer, 'win1251');
    fs.writeFile('logs/'+util.format(file_name, date), buffer, function () {
        buffer = "";
        file_size = 0;
        file_number++;
    });
}

var start = function () {
    var process = spawn.spawn('node', ['server.js']);

    process.on('error', function () {
        console.log('some error in process');
    });

    process.stdout.on('data', function (data) {
        var d = dateFormat(Date.now(), 'dd-mm-HH-MM-ss');
        console.log(d + " : " + data);
        buffer += d + " : " + data;
        file_size++;
        if (file_size > 1000) {
            writeBuffer(d);
        }
    })

    process.on('close', function () {
        start();
    })
}

start();
/**
 * Created by Halck on 11.05.2018.
 */

const MongoClient = require('mongodb').MongoClient;
var config = require('./config.json');
var nodelist = require("./nodelist.json");
const test = require('assert');
// Connection url
const url = 'mongodb://thesatanist:fv017kpp@cluster0-shard-00-00-qbsmj.mongodb.net:27017,cluster0-shard-00-01-qbsmj.mongodb.net:27017,cluster0-shard-00-02-qbsmj.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin';
// Database Name
const dbName = config.mongodb;
var global_client = null;

var init = function () {
    MongoClient.connect(url, function(err, client) {
        // Use the admin database for the operation
        const adminDb = client.db(dbName).admin();
        // List all the available databases
        adminDb.listDatabases(function(err, dbs) {
            test.equal(null, err);
            test.ok(dbs.databases.length > 0);
            global_client = client;
            //console.log(dbs.databases);
            //client.close();
        });

        console.log("mongo::init:: mongo base connected");
    });
}

var check_user = async function (chat_id) {
    return new Promise((resolve, reject) => {
        if (global_client != null) {
            try {
                var col = global_client.db(dbName).collection('users');
                col.find({chat_id: chat_id}).toArray(function (err, items) {
                    //console.log("mongo::check_user:: Found items");
                    //console.log(items);
                    if ((items == undefined) || (items == null) || (items.length == 0)) {
                        col.insert({
                            chat_id: chat_id,
                            seller: true,
                            logs: []
                        }, function (err, result) {
                            if ((err == undefined) || (err == null)) {
                                console.log("mongo::check_user:: New user added " + chat_id);
                            }
                        });
                        resolve([{}]);
                    } else {
                        //console.log("mongo::check_user::" + JSON.stringify(items));
                        resolve(items);
                    }
                });
            } catch (e) {
                resolve([{}]);
                console.log("mongo::check_user:: Unexpected error during mongo db insertion::" + e);
            }
        }
    });
}

var add_logs = function (chat_id, logs, callback) {
    var col = global_client.db(dbName).collection('users');
    console.log(logs);
    col.findOneAndUpdate({chat_id: chat_id}, {"$push" : {'logs' : {'$each': logs}}}, {}, function (err, result) {});

    if (callback != undefined) {
        callback();
    }
}

var add_preset = function (chat_id, n , state, callback) {
    var col = global_client.db(dbName).collection('users');

    var preset = [{
        "n" : n,
        "s" : state,
        "date": Date.now()
    }]

    col.findOneAndUpdate({chat_id: chat_id}, {"$addToSet" : {'preset' : {'$each': preset}}}, {}, function (err, result) {
        console.log("mongo::add_preset::" + err);
    });


    if (callback != undefined) {
        callback();
    }
}

var get_users = async function(query, callback) {
    var col = global_client.db(dbName).collection('users');
    var result = col.find(query).toArray(function (err, result) {
        callback(err, result);
    });
    return result;
}

var delete_preset = async function (chat_id, preset) {
    return new Promise((resolve, reject) => {
        var col = global_client.db(dbName).collection('users');
        col.findOneAndUpdate({chat_id: chat_id}, {"$pull" : {'preset' : {'n': preset.n}}}, {}, function (err, result) {
            if (err) {
                resolve(false);
            }
            resolve(true);
        });
    })
}

var recheck_presets = async function(chat_id, presets) {
    var col = global_client.db(dbName).collection('users');
    return new Promise((resolve, reject) => {
        for (var i = 0; i < presets.length; i++) {
            var node = nodelist.nodes.filter((element) => {
                if (element.num == presets[i].n) return true;
            })[0];
            if (presets[i].date == undefined) {
                presets[i].date = 0;
            }
            var timeElapsed = (Date.now() - presets[i].date) / 1000 / 60 / 60 / 24 / 7 / 30;
            console.log("mongo::recheck_presets::time elapsed for " + presets[i].n + " is " + timeElapsed);
            if (timeElapsed > node.permanent) {
                var deleteRequest = delete_preset(chat_id, presets[i]);
                console.log(deleteRequest);
            }
        }
        resolve(true);
    });
}

module.exports.init = init;
module.exports.check_user = check_user;
module.exports.add_logs = add_logs;
module.exports.get_users = get_users;
module.exports.add_preset = add_preset
module.exports.recheck_presets = recheck_presets;
/**
 * Created by Halck on 20.04.2018.
 */

const spawn = require('child_process');
var net = require('net');
var encoder = require('iconv-lite');
var logics = require('./logics.js');
var mongo = require('./mongo.js');
var config = require('./config.json');

var clients = []; //{'chat_id': , 'port': 'last_active': 'busy': 'handler': 'asks':, 'log', kicker:}

var ports = []; //{'port', 'status', 'process', 'busy', 'attempts'} -1 - closed, 0 - pending, 1 - open
var pending_ports = 0;
var active_ports = 0;
var ports_low = 3100;
var ports_high = 3200;
var ports_current = 3100;

var waiting_for_check_flag = true;
var is_process_created = false;

var chl_ps = [];

var sc_folder_name = 'C:\\Users\\Halck\\Documents\\Visual Studio 2015\\Projects\\sc.3.2\\Debug\\';
var KICK_TIMEOUT = config.clients.port_timeout;

var check_port = function (port) {
    console.log("Checking if port exist " + port);
    var client = new net.Socket();
    client.connect(port, '127.0.0.1', function() {
        console.log('Connected');
        client.write("chk");
    });

    client.on('data', function (data) {
        data = encoder.decode(data, 'win1251');
        console.log("Got data from process: ");
        console.log(data);
        if (data == "ok") {
            console.log("process successfully running on " + this.address().port);
            //console.log(this);
            active_ports++;
            pending_ports--;
            ports[port - ports_low].status = 1;
        } else {
            console.log("process fails check");
            pending_ports--;
            ports[port - ports_low].status = -1;
        }

        client.destroy();
    });

    client.on('error', function (err) {
        console.log("clients::check_port:: Unable to set connection on port " + port);
        //console.log(err)
        pending_ports--;
        ports[port - ports_low].status = -1;
    })
}

var check_port_all = function (port) {

}

var create_process = function (port) {
    //var command_string = sc_folder_name + "sc.3.2.exe --mode 0 --port " + port;
    var command_string = sc_folder_name + "sc.3.2.exe";
    console.log(command_string);
    pending_ports++;
    ports[port - ports_low].status = 0;
    ports[port-ports_low].process = spawn.spawn(command_string, ['--mode', '1', '--port', port]);

    ports[port-ports_low].process.on('error', function () {
        console.log("Error in process creation");
        pending_ports--;
        ports[port - ports_low].status = -1;
    })

    ports[port-ports_low].process.stdout.on('data', function (data) {
        //data = encoder.decode(data, 'win1251')
        //console.log(data);
    });

    ports[port-ports_low].process.stderr.on('data', function (data) {
        console.log("Unable to create process on port : " + port);
        pending_ports--;
        ports[port - ports_low].status = -1;
    });

    ports[port-ports_low].process.on('close', function () {
        console.log("clients::create_process:: Closed process");
        active_ports--;
        ports[port - ports_low].status = -1;
    });

    var result = false;
    result = check_port(port);

    //while (waiting_for_check_flag) {}

    //console.log();
    return result;
}

var create_pull = function (N) {
    var need_ports = N - pending_ports - active_ports;
    var i = ports_low;
    while (need_ports > 0) {
        if (ports[i - ports_low].status < 0) {
            create_process(i);
        } else {
            i++;
        }
        need_ports = N - pending_ports - active_ports;
    }
}

var new_client = function (chat_id) {
    clients.push(chat_id);
}

var clear_ports = function () {
    for (var i = 0; i<100; i++) {
        ports.push({
            'port': ports_low + i,
            'status': -1,
            'process': null,
            'busy': false,
            'attempts': 0
        })
    }
}

var check_client = function(chat_id) {
    var is = clients.findIndex(function (element) {
        if (element.chat_id == chat_id) return true;
    })
    return is;
}

var get_port = function() {
    for (var i = 0; i < ports.length; i++) {
        if ((ports[i].process != null)&&(!ports[i].busy)) {
            ports[i].busy = true;
            ports[i].process.on('close', function () {
                ports[i].process = null;
                ports[i].busy = false;
                console.log("Процесс по порту " + ports[i].port + " неожиданно завершился. Это исключение пока не обработано.");
            });
            return i;
        }
        console.log(ports[i]);
    }
}

var change_port = function (index) {
    var corrupted_port = clients[index].port;
    clients[index].port = ports_low + get_port();
    console.log("cleints::change_port:: changing port for client #" + index + " due to corrupted port #" + corrupted_port + ' changed to #' + clients[index].port);
    ports[clients[index].port - ports_low].process.on('close', function () {
        change_port(index);
    })

    if (clients[index].logs.length != 0) {
        console.log("clients::change_port::resetting client sequence");
        for (var i = 0; i < clients[index].logs.length; i++) {
            var com = clients[index].logs[i].log;
            if (com.includes("set")) {
                console.log("clients::change_port::resetting client sequence::" + com);
                req(com, clients[index].port, function () {}, index);
            }
        }
    }
}

var kick_client = function (chat_id) {
    console.log('clients::kicking client #' + chat_id);
    var index = check_client(chat_id);
    var removed = clients.splice(check_client(chat_id), 1);
    var removed_port = removed[0].port;
    req("clr", removed_port);

    var port_n = ports.findIndex(function (element) {
        if (element.port == removed_port) return true;
    });

    ports[port_n].busy = false;
}

var parseMsg2 = async function(chat_id, msg, msg_id) {
    var index = check_client(chat_id);
    if (check_client(chat_id) == -1) {
        var new_port = ports_low + get_port();
        console.log("New client " + chat_id + " appeared. Connected to port " + new_port);
        clients.push({
            'chat_id': chat_id,
            'port': new_port,
            'handler': logics.init_ask,
            'asks':0,
            'logs': [],
            'kicker': setTimeout(function () {
                kick_client(chat_id);}, config.clients.kicker_timeout * 60 * 1000)
        });
        index = clients.length - 1;
        ports[new_port - ports_low].process.on('close', function () {
            change_port(index);
        })
    } else {
        console.log("Existed client");
    }

    clearTimeout(clients[index].kicker);
    clients[index].kicker = setTimeout(function () {
        kick_client(chat_id);}, config.clients.kicker_timeout * 60 * 1000);

    clients[index].logs.push({
        'date': Date.now(),
        'log': msg
    })
    clients[index].handler = await clients[index].handler(chat_id, msg, clients[index].port, index, msg_id);
}

var send_request = async function(com, response, chat_id) {

    //Checking port for index

    var index = check_client(chat_id);
    if (check_client(chat_id) == -1) {
        var new_port = ports_low + get_port();
        console.log("New client " + chat_id + " appeared. Connected to port " + new_port);
        clients.push({
            'chat_id': chat_id,
            'port': new_port
        });
        index = clients.length - 1;
    } else {
        console.log("Client " + chat_id + " alredy exists. Connected to port " + clients[index].port)
    }

    //sending request

    console.log("sendRequest: " + com);

    var command = new net.Socket();
    var socket = new net.Socket();
    if (!clients[index].busy) {
        clients[index].busy = true;
        socket.connect(clients[index].port, '127.0.0.1', function () {
            console.log('Connected ' + clients[index].port);
    //console.log(client);
    socket.write(com);
});
} else {
    console.log("Client on port " + clients[index].port + " is busy. Waiting for response.");
}
socket.on('error', function (error) {
    console.log('client error: ');
    response(chat_id, "Ошибка приложения. Не удается подключится к порту.")
    console.log(error);
    clients[index].busy = false;
    })

    socket.on('data', function (data) {
        data = encoder.decode(data, 'win1251');
        console.log("Получен ответ от сервера " + encoder.decode(data, 'win1251'));

        if (com.includes('start')) {
            response(chat_id, data + " Вы присоединены к порту " + clients[index].port);
        }

        if (com.includes('set')) {
            response(chat_id, data);
        }

        if (com.includes('calc')) {
            response(chat_id, data);
        }

        if (com.includes('help')) {

        }

        if (com.includes('clr')) {
            response(chat_id, data);
        }

        clients[index].busy = false;

        socket.destroy();
    });

    socket.on('close', function () {
        console.log('Connection with socket closed');
    });
}

var set_sc_folder_path = function (s) {
    sc_folder_name = s;
}

var clients_init = function(response, sendMenu, edit_message) {
    mongo.init();
    logics.logics_init(response, sendMenu, edit_message, req, client_up_asks, client_set_busy, client_set_free, client_null_asks, client_get_logs, client_free_logs, client_preset);
}

var req = function (com, port, response, index) {
    var socket = new net.Socket();

    socket.connect(port, '127.0.0.1', function () {
        console.log('Connected ' + port);
        //console.log(client);
        if (index!=undefined) {
            clients[index].logs.push({
                'date': Date.now(),
                'log': com
            });
        }
        socket.write(com);
    });

    socket.on('error', function (error) {
        ports[port - ports_low].attempts++;
        console.log('client::req:: client error after ' + ports[port - ports_low].attempts + ' attempts');

        if (ports[port - ports_low].attempts < 10) {
            console.log("clients::req:: resending socket request for port#" + port);
            socket.destroy();
            setTimeout(function () {
                    req(com, port, response, index);
                }, 500);
        } else {
            change_port(index);
        }
    })

    socket.on('data', function (data) {
        data = encoder.decode(data, 'win1251');
        console.log("Получен ответ от сервера " + encoder.decode(data, 'win1251'));

        if (response != undefined) {
            response(data);
        }
        ports[port - ports_low].attempts = 0;

        socket.destroy();
    });

    socket.on('close', function () {
        console.log('Connection with socket closed');
        socket.destroy();
    });

}

var client_up_asks = function (index, up) {
    if ( (up == undefined)||(up == null)) {
        clients[index].asks = clients[index].asks + 1;
    } else {
        clients[index].asks = clients[index].asks + up;
    }
    //console.log("That's " + clients[index].asks + " asks");
    return clients[index].asks;
}

var client_null_asks = function(index) {
    clients[index].asks = clients[index].asks = 0;
    return clients[index].asks;
}

var client_set_busy = function (index) {
    console.log(index);
    if (clients[index].busy) {
        console.log("CLIENT IS BUSY!");
        return false;
    }
    clients[index].busy = true;

    return true;
}

var client_set_free = function (index) {
    clients[index].busy = false;
}

var client_get_logs = function (index) {
    return clients[index].logs;
}

var client_free_logs = function (index) {
    mongo.add_logs(clients[index].chat_id, clients[index].logs, function () {
        clients[index].logs = [];
        console.log("clients::client_free_logs:: client #" + index + " logs setted free. Data pushed to mongoDB");
    });
}

var client_preset = function (index, presets) {
    console.log("clients::client_preset::" + JSON.stringify(presets));
    var com = "preset ";
    for (var i = 0; i < presets.length; i++) {
        console.log(presets[i]);
        com = com + presets[i].n + " " + presets[i].s + " ";
    }
    com = com.trim();
    req(com, clients[index].port, () => {}, index);
}

module.exports.set_sc_folder_path = set_sc_folder_path;
module.exports.create_pull = create_pull;
module.exports.check_port = check_port;
module.exports.clear_ports = clear_ports;
module.exports.send_request = send_request;
module.exports.logics = logics;
module.exports.parseMsg2 = parseMsg2;
module.exports.clients_init = clients_init;
module.exports.client_up_asks = client_up_asks;
module.exports.client_get_logs = client_get_logs;



















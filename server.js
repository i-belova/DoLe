/**
 * Created by Halck on 18.04.2018.
 */

var url = require('url');
var https = require('https');
var SocksProxyAgent = require('socks-proxy-agent');
var encoder = require('iconv-lite');
var clients_module = require('./clients.js');
var net = require('net');
var config = require('./config.json');
var nodelist = require('./nodelist.json');
var http = require('./http_module.js');
var doctors = require('./doctors.json');
const EventEmitter = require('events');

//Создать начальный процесс для 1го клиента
//clients_module.check_port(3101);
clients_module.set_sc_folder_path(config.sc_folder_path);
clients_module.clear_ports();
clients_module.create_pull(config.process_pull);
clients_module.logics.send_msg = sendMessage;

var TOKEN = config.test ? config.test_token : config.token;

http.init();

// SOCKS proxy to connect to
var proxy =  process.env.socks_proxy || 'socks://' + config.proxy;
console.log('using proxy server %j', proxy);

// HTTP endpoint for the proxy to connect to
//var endpoint = process.argv[2] || 'https://api.telegram.org/bot310463528:AAEvHttY7fvpRn2rjEF-nwdLzedz-Yd91MM/getUpdates';
//console.log('attempting to GET %j', endpoint);

// create an instance of the `SocksProxyAgent` class with the proxy server information
// NOTE: the `true` second argument! Means to use TLS encryption on the socket
var agent = new SocksProxyAgent(proxy, true);

var lastOffset = 1000;
var is_first_check = true;

var eternalUpdater;

var updateParser = function (data) {
    var msgs = [];
    try {
        var result = JSON.parse(data).result;
    } catch (e) {
        console.log("JSON parsing error");
        return;
    }
    if ((result!=undefined)&&(result.length > 0)) {
        for (i = 0; i < result.length; i++) {
            if (result[i].update_id >= lastOffset) {
                if (result[i].hasOwnProperty("message")) {
                    msgs.push({
                        'chat_id': result[i].message.chat.id,
                        'msg': result[i].message.text,
                        'id': 0
                    });
                } else if (result[i].hasOwnProperty('callback_query')) {
                    console.log()
                    msgs.push({
                        'chat_id': result[i].callback_query.message.chat.id,
                        'msg': result[i].callback_query.data,
                        'id': result[i].callback_query.message.message_id
                    });
                }
            }
        }
        lastOffset = result[result.length - 1].update_id + 1;
        console.log("server::updateParser:: lastOffset - " + lastOffset);
        parseMessages(msgs);
    }
};

var startUpdater = function () {
    console.log("Запрос отправлен");
    // Perform first check to get initial offset
    var getOffset = function (data) {
        console.log(data);
        try {
            var result = JSON.parse(data).result;
        } catch (e) {
            console.log("Error during JSON parsing");
        }
        if ((result != undefined)&&(result.length != 0)) {
            if (result[result.length - 1].update_id >= lastOffset) {
                lastOffset = result[result.length - 1].update_id + 1;
            }
        }
        return lastOffset;
    };

    var request = http.update();

    request.on('end', function (data) {
        lastOffset = getOffset(data);
        console.log("Last offset: ");
        console.log(lastOffset);

        var eternalUpdater = new EventEmitter();

        curl = 'https://api.telegram.org/bot' + TOKEN + '/getUpdates?offset=';

        setTimeout(function updateEternal_once () {
            var req = http.request(curl + lastOffset, config.request_timeout);
            console.log("server::startUpdater:: send request to server with offset = " + lastOffset);
            req.on('end', function (data) {
                eternalUpdater.emit('response', {"data": data, "offset": lastOffset});
            })
            req.on('error', function (error) {
                eternalUpdater.emit('err', error);
                req = null;
            })

            setTimeout(updateEternal_once, config.request_timeout);
        }, config.request_timeout);


        eternalUpdater.on('response', function (data) {
            console.log("server::startUpdater:: Got response from server with offset = " + data.offset);
            console.log(data.data);
            updateParser(data.data);
        });

        eternalUpdater.on('error',function () {
            console.log('server::startUpdater:: Unable to get response from server');
        });
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

startUpdater();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function parse_calc_output(ss) {
    var result = "";

    var diseases = ss.match("(<diseases>((\\d|-|\\.)+\\n)+</diseases>)");

    if (diseases == null) {
        return "Расчеты произведены";
    } else {
        diseases = diseases[0];
    }

    var diseases_s = diseases;
    diseases_s = diseases_s.replace("<diseases>", "Мы предполагаем у вас наличие следующих заболеваний:\n");

    /*while (diseases_s.match('\n')!=null) {
        diseases_s = diseases_s.replace("\n", "<newline>");
    }*/

    var doctor_list = [];

    var re = /(^[\d]+-)/gm;
    var f = diseases_s.match(re);
    console.log(f);
    if (f!=null) {
        for (var j = 0; j < f.length; j++) {
            //console.log(f[j]);
            var n = Number(f[j].substr(0, f[j].length - 1));
            var node = nodelist.nodes.filter(node => node.num == n)[0];
            if (node != undefined) {
                var reg = "(^" + f[j] + ")";
                reg = RegExp(reg, 'gm');
                //diseases_s = diseases_s.replace("\n" + f[j] + "", "\n" + node.name + "-" + f[j]);
                diseases_s = diseases_s.replace(reg, node.name + "-" + f[j]);

                var reg_for_prob = "(-" + f[j] + "([\\d|.]+))";

                reg_for_prob = RegExp(reg_for_prob, 'gm');
                var prob_m = diseases_s.match(reg_for_prob)[0];
                prob_m = prob_m.substr(1);

                prob_m = prob_m.substr(prob_m.indexOf('-') + 1);

                var prob = Number(prob_m);

                var doctor_name;

                try {
                    doctor_name = doctors.items.filter((element) => {
                        if (element.name == node.name) return true;
                    })[0].doctor;
                } catch (e) {
                    doctor_name = "Врач-терапевт";
                }

                var search_result_index = -1;

                var search_result = doctor_list.filter((element, index) => {
                    if (element.doctor == doctor_name) {
                        search_result_index = index;
                        return true;
                    }
                });

                if (search_result_index == -1) {
                    doctor_list.push({
                            "doctor": doctor_name,
                            "prob": [prob]
                        }
                    )
                } else {
                    doctor_list[search_result_index].prob.push(prob);
                }
            } else {
                var reg = "(^" + f[j] + ".+$)";
                diseases_s = diseases_s.replace(reg, "");
            }
        }
    }

    //замена по запросу Резника об удалении номера заболевания в базе
    //diseases_s = diseases_s
    var re = /(-(\d+)-)/gm;
    diseases_s = diseases_s.replace(re, '-');

    console.log()

    var doctors_s = "\n\n Мы рекомендуем вам обратиться к следующим врачам:\n"

    console.log(doctor_list);

    for (var i = 0; i < doctor_list.length; i++) {
        var prob = 1;
        for (var j = 0; j < doctor_list[i].prob.length; j++) {
            prob = prob * (1 - doctor_list[i].prob[j]);
        }
        doctor_list[i].prob = 1 - prob;
        doctors_s = doctors_s +  doctor_list[i].doctor + " - " + Math.round(doctor_list[i].prob * 100) + "% \n";
    }



    result = result + diseases_s;

    re = /(\d\.\d+)/g;
    f = result.match(re);

    console.log("Расчет %");
    console.log(f);

    if (f!=null) {
        for (var j = 0; j < f.length; j++) {
            result = result.replace(f[j], "" + Math.round(Number(f[j]) * 100) + "%");
        }
    }

    result = result.replace('</diseases>', '');

    result = result + doctors_s;

    return result;

}

function parse_calc_output_info(ss) {
    var infos = ss.match("(<info>((\\d|-|\\.)+\\n)+</info>)")[0];

    console.log(ss);
    console.log(infos);

    var re = /([\d]+-)/;
    f = infos.match(re)[0];

    var n = Number(f.substr(0, f.length - 1));

    return n;
}

function get_encoded_URI(msg) {
    var msg_dis = msg;
    if (msg.indexOf('\n') == -1) {
        return encodeURI(msg);
    }
    if (msg.match("(<.+>((\\d|-|\\.)+\\n)+</info>)") != null) {
        msg_dis = parse_calc_output(msg);
    }
    var ss = msg_dis.split('\n');
    result = ""
    for (var i = 0; i < ss.length - 1; i++) {
        result = result + encodeURI(ss[i]) + "\n";
    }
    result = result + encodeURI(ss[i]);
    return result;
}

function sendMenu(chat_id, keyboard, msg) {
    var req = encodeURI("https://api.telegram.org/bot" + TOKEN + "/sendMessage" + "?chat_id=" + chat_id + "&text=") + get_encoded_URI(msg);
    /*var keyboard = JSON.stringify({
        inline_keyboard: [
            [{text: 'Что ты такое?', callback_data: 'first'}],
            [{text: 'start', callback_data: 'start'}],
            [{text: 'calc', callback_data: 'calc'}],
            [{text:'help', callback_data: 'help'}]
        ]
    });*/
    req = req + encodeURI('&reply_markup=' + keyboard);
    console.log(req);
    var endpoint = req;

    var send_result = new Promise((resolve, reject) => {

        var menu_request = http.request(endpoint);

        menu_request.on('end', (res) => {
            console.log("server::sendMenu");
            res = JSON.parse(res);
            if ((res.hasOwnProperty('result'))&&(res.result.hasOwnProperty('message_id'))) {
                console.log('server::sendMenu:: menu sent: ' + res.result.message_id);
                resolve(res.result.message_id);
            }
        });

    })

    return send_result;


/*
    var opts = url.parse(endpoint);

    opts.agent = agent;

    https.get(opts, function (res) {
        var body = '';
        var result = res.data;
        res.on('data', function (chunk) {
            body+=chunk;
        });
    });
 */
}

function sendMessage(chat_id, msg) {

    var endpoint = encodeURI("https://api.telegram.org/bot" + TOKEN + "/sendMessage" + "?chat_id=" + chat_id + "&text=") + get_encoded_URI(msg);

    http.request(endpoint, 0, function () {
        if (msg.match("(<info>((\\d|-|\\.)+\\n)+</info>)") != null) {
            var n = parse_calc_output_info(msg);

            /*var keyboard = JSON.stringify({
                inline_keyboard: [
                    [{text: 'Да', callback_data: 'set ' + n + " 0"}],
                    [{text: 'Нет', callback_data: 'set ' + n + " 1"}],
                    [{text: 'Закончить', callback_data: 'finish'}]
                ]
            });
*/

            var keyboard = {
                inline_keyboard: []
            }
            var node = nodelist.nodes.filter(node => node.num == n)[0];

            console.log(node);

            var states = node.states.split(';');

            for (var k = 0; k < states.length; k++) {
                if (states[k].length < 2) break;
                keyboard.inline_keyboard.push([{text: states[k], callback_data: 'set ' + node.num + ' ' + k}]);
            }
            keyboard.inline_keyboard.push([{text: 'Закончить', callback_data: 'finish'}]);

            keyboard = JSON.stringify(keyboard);

            console.log(keyboard);

            sendMenu(chat_id, keyboard, "У вас есть симптом " + node.name + "?");
        }
    });
}

//----------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------

/*
var client = new net.Socket();
/*client.connect(3101, '127.0.0.1', function() {
    console.log('Connected');
    client.write('chk');
});*/
/*
client.on('data', function(data) {
    //console.log('Received: ' + data);
    if (!(data.contains("ok"))) {
        process.exit(-1);
    }
    client.destroy(); // kill client after server's response
});

client.on('close', function() {
    console.log('Connection closed');
});
*/
function sendRequest(com, response, chat_id) {

    console.log("sendRequest: " + com);

    var command = new net.Socket();
    var client = new net.Socket();
    client.connect(3101, '127.0.0.1', function() {
        console.log('Connected');
        client.write(com);
    });

    client.on('data', function (data) {
        data = encoder.decode(data, 'win1251');
        console.log("Получен ответ от сервера " + encoder.decode(data, 'win1251'));

        if (com.includes('start')) {
            sendMessage(chat_id, data);
        }

        if (com.includes('set')) {
            sendMessage(chat_id, data);
        }

        if (com.includes('help')) {

        }

        client.destroy();
    });

    client.on('close', function () {
        console.log('Connection with socket closed');
    })
}

function parseMsg(msg) {
    if (msg.msg.includes("start")) {
        clients_module.send_request('start', sendMessage, msg.chat_id);return;
    }
    if (msg.msg.includes("set")) {
        clients_module.send_request(msg.msg, sendMessage, msg.chat_id);return;
    }
    if (msg.msg.includes("calc")||(msg.msg.includes("calculate"))) {
        clients_module.send_request('calc', sendMessage, msg.chat_id);return;
    }
    if (msg.msg.includes("pnt")||msg.msg.includes("print")) {
        clients_module.send_request('pnt', sendMessage, msg.chat_id);return;
    }
    if (msg.msg.includes("clr")||msg.msg.includes("clear")) {
        clients_module.send_request('clr', sendMessage, msg.chat_id);return;
    }
    if (msg.msg.includes("first")) {
        sendMessage(msg.chat_id, "Я - чат-бот симптом-чекер. Вы вводите симптомы, я прогнозирую наличие заболевания " +
            "и определяю наиболее вероятные и наиболее важные симптомы для дальнейшей диагностики.\n" +
            "Чтобы начать работу, введите или выберите из меню команду start или команду calc.\n" +
            "К сожалению, я пока не умею распознавать человекческую речь, поэтому ввод симптомов осуществляется по номерам " +
            "из мое базы данных. Поиск по ней можно осуществить введя часть симптома. К примеру, если вы введете 'температура' я выдам" +
            " Вам все вхождения этого слова в базе данных. Пожалуйста, учитывайте склонения слов, лучше вводить не 'температура', " +
            "а 'температур'. Мы работаем над возможностью анализа текста.\n");
    }

    if (msg.msg.includes("help")) {
        sendMessage(msg.chat_id, "Список доступных команд:\n" +
            "set 1000 0 - установить симптом в нужное состояние\n" +
            "start - запрос на начало работы, вам будет выделен процесс для работы с приложением\n" +
            "calc - расчитать и выдать результат\n" +
            "pnt - распечатать результаты последнего расчета\n" +
            "clr - очистить все установленные симптомы и начать заново\n" +
            "1000 - установить 1000й симтом в состояние 0. \n" +
            "Оптимальный вариант работы - " +
            "начать с команды start, затем установить нужные первые симптомы, после того, как один или несколько симптомов установлены" +
            "расчитать командой calc. При необходимости использовать pnt или clr. По умолчанию для всех симптомов коды состояний: 0 - Есть, 1 - Нет");
        return;
    }

    if (!(isNaN(Number(msg.msg)))) {
        clients_module.send_request("set " + msg.msg + " 0", sendMessage, msg.chat_id);return;
    } else {
        var words = msg.msg.split(' ');
        if ((words == undefined)||(words.length == 0)) words = [msg.msg];
        var found = [];
        for (var i = 0; i < nodelist.nodes.length; i++) {
            var has = true;
            for (var j = 0; j < words.length; j++) {
                if ((i > 600)&&(i < 610)) {
                    console.log(i);
                    console.log(words[j]);
                }
                if ((words[j]!=" ")&&(nodelist.nodes[i].name.indexOf(words[j]) >= 0)) {
                } else {
                    has = false;
                    break;
                }
            }
            if (has) found.push({
                name: nodelist.nodes[i].name,
                index: i,
                num: nodelist.nodes[i].num
            });
            //if (found.length > 10) break;
        }

        if (found.length == 0) {
            sendMessage(msg.chat_id, "Неопознанная строка. Проверьте правильность написания или введите 'help' для списка команд.");
            //sendMenu(msg.chat_id);
            return;
        } else if (found.length > 10) {
            //console.log(found);
            found.sort(function (a,b) {
                return a.name.length - b.name.length;
            });
            var s = "";
            for (var p = 0; p < 10; p++) {
                s = s + found[p].index + " - " +  found[p].name + "\n";
            }
            sendMessage(msg.chat_id, s + "(и еще " + (found.length - 10) + " совпадений.");
            sendMessage(msg.chat_id, "Слишком много совпадений. Уточните запрос."); return;
        } else {
            var s = "";
            for (var p = 0; p < found.length; p++) {
                s = s + found[p].index + " - " +  found[p].name + "\n";
            }
            sendMessage(msg.chat_id, s);
            return;
        }
    }

    sendMessage(msg.chat_id, "Неопознанная команда. Введите 'help' для полного списка команд.");
}

function parseMsg2(msg) {
    clients_module.parseMsg2(msg.chat_id, msg.msg, msg.id)
}

function parseMessages(msgs) {

    var chat_id_turn = [];

    for (var i = 0; i < msgs.length; i++) {
        //console.log("checker array = ");
        //console.log(checkerArray);
        if (chat_id_turn.indexOf(msgs[i].chat_id) == -1) {
            msgs[i].msg = msgs[i].msg.toLowerCase();
            //console.log("server::parseMessages::" + JSON.stringify(msgs[i]));
            parseMsg2(msgs[i]);
            chat_id_turn.push(msgs[i].chat_id);
        }
    }
}

var edit_message = function (chat_id, msg_id, text) {
    var endpoint = encodeURI("https://api.telegram.org/bot" + TOKEN + "/editMessageText" + "?chat_id=" + chat_id + "&message_id=" + msg_id + "&text=") + get_encoded_URI(text);

    http.request(endpoint);

    console.log("server::edit_message::order to delete message " + msg_id);


}

clients_module.clients_init(sendMessage, sendMenu, edit_message);
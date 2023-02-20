/**
 * Created by Halck on 07.05.2018.
 */

var init_ask;
var init_handler;
var set_handler;
var req;
var nodelist = require("./nodelist.json");
var http_native = require('http');
var config = require('./config.json');


var mongo = require("./mongo.js");

var send_msg = function () {
    console.log("Error in binding");
};
var client_up_asks = function () {
    console.log("Error in binding");
}

var client_set_busy = function () {
    console.log("Error in binding");
}
var client_set_free = function () {
    console.log("Error in binding");
}
var client_get_logs = function () {
    console.log("Error in binding");
}

var clients_free_logs = function () {
    console.log("logics::clients_free_logs:: Error in binding");
}

var client_preset = function () {
    console.log("logics::client_preset:: Error in binding");
}

var finish = function (chat_id, msg, port, index) {
    client_up_asks(index, -client_up_asks(index, 0));

    clients_free_logs(index);

    req('clr', port, function () {
        send_msg(chat_id, 'Ваш сеанс завершен. Симптомы сброшены, чтобы начать заново, начните вводить новые симптомы');
        client_set_free(index);
    });
}

var edit_message;

var send_menu;

var cut_symptom = function (s) {
    var words = s.split('>');
    var last = words.length - 1;
    if (words.length < 2) {
        return words[last];
    }
    return words[last - 1] + ">" + words[last];
}

var uber_logic = function (chat_id, msg, port, index, func) {
    if (func == undefined) {
        func = 1;
    }
    if (msg.includes('\\list')) {

        var logs = client_get_logs(index);
        console.log(logs);

        var answer = "";
        var sets = [];

        for (var i = 0; i < logs.length; i++) {
            var log = logs[i];
            if (log.log.includes("set ")) {
                var nums = log.log.split(' ');

                for (var j = 1; j < nums.length; j += 2) {
                    var s_num = Number(nums[j]);
                    var s_state = Number(nums[j + 1]);

                    var ind = sets.filter(el => {
                        return el.num == s_num;
                    })

                    if (ind.length == 0) {
                        sets.push({
                            'num': s_num,
                            'state': s_state
                        })
                    }
                }

            }
        }

        for (var j = 0; j < sets.length; j++) {
            var node = nodelist.nodes.filter(n => {return n.num == sets[j].num});
            if ((node != null)&&(node != undefined)&&(node.length > 0)) {
                node = node[0];
            }
            states = node.states.split(';')
            answer = answer + node.name + " - " + states[sets[j].state] + "\n";
        }

        send_msg(chat_id, "Список ранее введенных симптомов:\n" + answer);

        return func;
    }
    if (msg.includes('\\help')) {
        send_msg(chat_id, 'Список команд: \n' +
            '\\stop - завершить сеанс работы и сбросить введенные симптомы\n' +
            '\\list - список уже введенных симптомов');
        return func;
    }

    if (msg.includes('\\stop')) {
        finish(chat_id, msg, port, index);
        return init_handler;
    }

    return null;
}

var search_symptom = function(chat_id, msg) {

    var nlpRequest = new Promise(function (resolve, reject) {

        var body = JSON.stringify({
            'query': msg
        })

        var request = new http_native.ClientRequest({
            hostname: "localhost",
            port: config.nlp_port,
            path: config.nlp_state,
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body)
            }
        })

        var nlpResponse = "";

        request.on('response', function (res) {

            console.log("Response from nlp server got!!!");

            res.on('data', (chunk)=> {
                nlpResponse += chunk;
            });

            res.on('end', ()=> {
                console.log("Response from NLP got.");
                console.log(nlpResponse);
                if ((nlpResponse == null)||(nlpResponse == undefined)||(nlpResponse == [])) {
                    send_msg(chat_id, "Я Вас не понял, попробуйте изменить запрос");
                    resolve(-1);
                    return;
                }
                try {
                    nlpResponse = JSON.parse(nlpResponse);
                } catch (ex) {
                    send_msg(chat_id, "Я Вас не понял, попробуйте изменить запрос");
                    resolve(-1);
                    return;
                }


                var compare = function (a,b) {
                    if (a.score > b.score) return -1;
                    else return 1;
                }

                var pr = function (e) {
                    e.mean = null;
                    e.n = e.ori.n; // ЕБАННЫЙ КОЛХОЗ!!! // УЖЕ НЕ ЕБАННЫЙ, НО ЕЩЕ КОЛХОЗ
                    e.ori = null;
                    e.score = e.score;
                }

                nlpResponse.result.sort(compare);
                nlpResponse.result.forEach(pr);
                nlpResponse = nlpResponse.result.slice(0, 9);

                var found = [];

                for (var i = 0; i < nlpResponse.length; i++) {
                    if (nlpResponse[i].score > 0.5) {
                        var nodelistFounded = nodelist.nodes.findIndex((e) => {
                            if (e.num == nlpResponse[i].n) return true;
                            return false
                        });
                        var duplicate = found.findIndex((e)=> {
                            if (e.index == nodelistFounded) return true;
                            return false;
                        });
                        if (duplicate < 0) {
                            found.push({
                                name: nodelist.nodes[nodelistFounded].name,
                                index: nodelistFounded,
                                num: nlpResponse[i].n,
                                score: nlpResponse[i].score
                            })
                        }
                    }
                }

                console.log('logics::search:: found results')
                console.log(found);



                if (found.length == 0) {
                    send_msg(chat_id, "Неопознанная строка. Проверьте правильность написания или введите 'help' для списка команд.");
                    //sendMenu(msg.chat_id);
                    reject(-1);
                } else if ((found.length >= 8)&&(nlpResponse[nlpResponse.length - 1].score > 0.8)) {
                    var max_score = found[0].score;
                    console.log(max_score);
                    var s = "";
                    var menu = [];
                    for (var p = 0; p < found.length; p++) {
                        //s = s + found[p].index + " - " +  found[p].name + "\n";
                        var rel = Math.round(found[p].score / max_score * 100);
                        console.log("rel - ", rel);
                        menu.push([
                            {
                                text: cut_symptom(found[p].name) + " - " + rel + "%",
                                callback_data: "button_set " + found[p].num + " 0"
                            }
                        ]);
                    }
                    menu = JSON.stringify({
                        inline_keyboard: menu
                    })
                    console.log(menu);
                    send_menu(chat_id, menu, "Слишком много совпадений. Уточните запрос. Найдено:");
                    //send_msg(chat_id, s + "(и еще " + (found.length - 10) + " совпадений.");
                    //send_msg(chat_id, "Слишком много совпадений. Уточните запрос."); return 1;
                } else {
                    var menu = [];
                    var max_score = found[0].score;
                    for (var p = 0; p < found.length; p++) {
                        //s = s + found[p].index + " - " +  found[p].name + "\n";
                        var rel = Math.round(found[p].score / max_score * 100);
                        menu.push([
                            {
                                text: cut_symptom(found[p].name) + " - " + rel + "%",
                                callback_data: "button_set " + found[p].num + " 0"
                            }
                        ]);
                    }
                    menu = JSON.stringify({
                        inline_keyboard: menu
                    })
                    send_menu(chat_id, menu, "Найдено:");
                    resolve(1);
                }

            });
        });

        request.end(body);
    });

    return nlpRequest;

}

init_ask = function(chat_id, msg, port, index) {

    mongo.check_user(chat_id);
    //mongo.add_logs(chat_id, client_get_logs(index));

    send_msg(chat_id, "Привет! Я симптом-чекер. Чтобы начать работу, начните вводить название симптома.\n" +
        "В данный момент в тестовом режиме работает анализ текстовых запросов. Результат распознавания выводиться в виде [симптом - релевантность]" +
        "Полный список доступных команд доступен по команде \\help");
    return init_handler;
}

req = function (com, port) {
    console.log("req");
}

ask_set_handler = function(chat_id, msg, port, index, msg_id) {

    var uber_result = uber_logic(chat_id, msg, port, index, ask_set_handler);
    if (uber_result != null) {
        return uber_result;
    }

    if (!client_set_busy(index)) {
        return ask_set_handler;
    }

    var response = function () {};

    if (!msg.includes('finish')) {
        console.log("logics::ask_set_handler::s_state", msg);
        console.log("logics::ask_set_handler::s_state", msg.split(' ')[2]);
        var s_num = Number(msg.split(' ')[1]);
        var s_state = Number(msg.split(' ')[2]);
        if ((s_num == undefined)||(s_num == null)||(s_num !== s_num)) {
            send_msg(chat_id, "Неверный запрос. Воспользуйтесь меню.");
            client_set_free(index);
            return ask_set_handler;
        }
        if ((s_state == undefined)||(s_state == null)||(s_state !== s_state)) {
            send_msg(chat_id, "Неверный запрос. Воспользуйтесь меню");
            client_set_free(index);
            return ask_set_handler;
        }
        var s_string = nodelist.nodes.filter((item) => {
            if (item.num == s_num) return true;
        })[0];
        console.log("logics::ask_set_handler::s_state", s_state);
        if (s_state == 0) {
            edit_message(chat_id, msg_id, "Вы выбрали, что у вас " + ("есть симтом ") + s_string.name);
        } else if (s_state == 1) {
            edit_message(chat_id, msg_id, "Вы выбрали, что у вас " + ("нет симтома ") + s_string.name);
        } else {
            edit_message(chat_id, msg_id, "Что-то пошло не так");
        }
        //edit_message(chat_id, msg_id, "Вы выбрали, что у вас " + (s_state==0?"есть симтом ":"нет симптома ") + s_string.name);
    } else {
        edit_message(chat_id, msg_id, "Вы выбрали закончить работу. Чтобы начать новый сеанс просто начините вводить симптом.");
    }


    if (msg.includes("finish")) {
        /*
         response = function (data) {
         data = data.replace("info", "no_info");
         send_msg(chat_id, data);
         //send_msg(chat_id, "Данные сброшены");
         client_set_free(index);
         client_up_asks(index, -client_up_asks(index, 0));
         console.log("logics::ask_set_handler:: asks reseted");
         req('clr', port, function () {

         }, index);
         }
         */
        //mongo.add_logs(chat_id, client_get_logs(index));

        finish(chat_id, msg, port, index);

        /*
         req(msg, port, function() {
         req('calc', port, response, index);
         }, index);
         */

        return init_handler;
    }

    var asks = client_up_asks(index);

    var n = Number(msg.split(' ')[1]);
    var state = Number(msg.split(' ')[2]);

    var node = nodelist.nodes.filter(node => node.num == n)[0];

    console.log("logics::ask_set_handler:: node - " + JSON.stringify(node));

    if (node.permanent > 0) {
        mongo.add_preset(chat_id, n, state);
    }

    if (asks > 2) {
        response = function (data) {
            send_msg(chat_id, data);
            client_set_free(index);
        }
    } else {
        response = function (data) {
            data = data.replace("diseases", "no_diseases");
            send_msg(chat_id, "Мы делаем предположение о наличии заболеваний начиная с 3х симптомов");
            send_msg(chat_id, data);
            client_set_free(index);
        }
    }

    //здесь устанавливается симптом!!!

    req(msg, port, function() {
        req('calc', port, response, index);
    }, index);

    return ask_set_handler;
}

add_set_handler = function(chat_id, msg, port, index, msg_id) {

    var uber_result = uber_logic(chat_id, msg, port, index);
    if (uber_result > 0) {
        return add_set_handler;
    }

    if (msg == "add_set_yes") {
        //send_msg(chat_id, "Введите новый симптом: ");
        edit_message(chat_id, msg_id, "Введите новый симптом: ");
        return init_handler;
    }

    if (msg == "add_set_no") {
        if (!client_set_busy(index)) return add_set_handler;

        edit_message(chat_id, msg_id, "Начинаю считать...");

        var asks = client_up_asks(index, 0);

        console.log("logics::add_set_handler:: asks for client " + asks);

        var response = function (data) {
            if (asks < 2) {
                data = data.replace("diseases", "no_diseases");
                send_msg(chat_id, "Мы делаем предположение о наличии заболеваний начиная с 3х симптомов");
            }
            send_msg(chat_id, data);
            client_set_free(index);
        }
        req('calc', port, response, index);
        //send_msg(chat_id, "Расчеты произведены");
        return ask_set_handler;
    }

    return init_handler(chat_id, msg, port, index, msg_id);

    return null;
}

search_handler = async function (chat_id, msg, port, index, msg_id) {

    var uber_result = uber_logic(chat_id, msg, port, index, search_handler);
    if (uber_result != null) {
        return uber_result;
    }

    if (msg.match("(^\\s?\\D+\\s?$)")) {
        var searchResult = await search_symptom(chat_id, msg);
        if (searchResult > 0) {
            return init_handler;
        } else {
            return null;
        }
    } else {
        return null;
    }
}

set_handler = function(chat_id, msg, port, index, msg_id) {

    var uber_result = uber_logic(chat_id, msg, port, index, set_handler);
    if (uber_result !=null) {
        return uber_result;
    }

    if (msg.match("(^\\s?\\d+\\s?$)")) {
        var keyboard = JSON.stringify({
            inline_keyboard: [
                [{text: 'Да', callback_data: 'add_set_yes'}],
                [{text: 'Нет', callback_data: 'add_set_no'}]
            ]
        });
        if (!client_set_busy(index)) {
            return set_handler;
        }
        edit_message(chat_id, msg_id, 'Пока тут ничего');
        req("set " + Number(msg) + " 0", port, function () {
            client_set_free(index);
        }, index);
        //send_msg(chat_id, "Принято.");
        client_up_asks(index);
        send_menu(chat_id, keyboard, "Принято. У вас есть еще симптомы?");
        return add_set_handler;
    } else {
        return null;
    }

    return set_handler;
}

button_set_handler = function(chat_id, msg, port, index, msg_id) {

    var uber_result = uber_logic(chat_id, msg, port, index, button_set_handler);
    if (uber_result != null) {
        return uber_result;
    }

    console.log(msg);
    if (msg.match("(^button_set\\s+\\d+\\s+\\d$)")) {
        var keyboard = JSON.stringify({
            inline_keyboard: [
                [{text: 'Да', callback_data: 'add_set_yes'}],
                [{text: 'Нет', callback_data: 'add_set_no'}]
            ]
        });
        var com = msg.replace('button_set', 'set');
        client_set_busy(index);
        var s_num = Number(msg.split(' ')[1]);
        var s_string = nodelist.nodes.filter((item) => {
            if (item.num == s_num) return true;
        })[0];
        edit_message(chat_id, msg_id, 'Вы выбрали симптом: ' + s_string.name);
        req(com, port, function () {
            client_set_free(index);
        }, index);
        //send_msg(chat_id, "Принято.");
        client_up_asks(index);
        send_menu(chat_id, keyboard, "У вас есть еще симптомы?");
        return add_set_handler;
    }
}

init_handler = async function(chat_id, msg, port, index, msg_id) {

    var uber_result = uber_logic(chat_id, msg, port, index, init_handler);
    if (uber_result != null) {
        return uber_result;
    }

    var check_result = await mongo.check_user(chat_id);

    var check_result = check_result[0];

    //console.log("init_handler::" + JSON.stringify(check_result));
    //console.log("init_handler::" + check_result.preset);

    if (check_result.hasOwnProperty("preset")) {
        mongo.recheck_presets(chat_id, check_result.preset);
        client_preset(index, check_result.preset);
    }

    var result;

    result = set_handler(chat_id, msg, port, index, msg_id);
    if (result != null) {
        return result;
    }

    result = await search_handler(chat_id, msg, port, index, msg_id);
    if (result != null) {
        return result;
    }

    result = button_set_handler(chat_id, msg, port, index, msg_id);
    if (result != null) {
        return result;
    }

    //send_msg(chat_id, "Я вас не понял.");

    return init_handler;
}

logics_init = function (response, sendMenu, edit_message_input, request, up_asks, busy, free, null_asks, get_logs, free_logs, preset) {
    console.log("Logics init");
    send_msg = response;
    send_menu = sendMenu;
    edit_message = edit_message_input;
    req = request;
    client_up_asks = up_asks;
    client_null_asks = null_asks;
    client_set_busy = busy;
    client_set_free = free;
    client_get_logs = get_logs;
    clients_free_logs = free_logs;
    client_preset = preset;
    mongo.init();
}

module.exports.logics_init = logics_init;
module.exports.req = req;

module.exports.init_handler = init_handler;
module.exports.init_ask = init_ask;
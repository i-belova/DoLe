const fs = require('fs');
const iconv = require('iconv-lite');

var write_doctors = function (nodes, callback_resolve) {

    let doctors = [];

    nodes.forEach( (el) => {
            if (el) {
                if (el.type == 20) {
                    if ((el.doctors)&&(el.doctors.length > 0)) {
                        doctors.push({
                            "name": el.name,
                            "doctor": el.doctors[0]
                        });
                    }
                }
        }
    });

    fs.writeFile("doctors.json", iconv.encode(JSON.stringify({
        'items': doctors
    }), 'utf-8'), () => {
        callback_resolve();
    })
};

var read_current_base = function (callback, callback_resolve) {
    fs.readFile('base.refactor.exp.json', {}, (err, data) => {

        data = iconv.decode(data, 'win1251');

        nodes = JSON.parse(data).nodes;

        callback(nodes, callback_resolve);
    })
};

function start5() {
    return new Promise((resolve, reject) => {
        read_current_base(write_doctors, resolve);
    });
}

module.exports = start5;
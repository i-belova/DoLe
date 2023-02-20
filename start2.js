////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////         Модуль ответственный за рефакторинг базы, вычисление недостающих вероятностей и пр.                  /////
/////                                                                                                              /////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



var refactor = require('./refactor');
var fs = require('fs');
var iconv = require('iconv-lite');
var integrity = require('./integrity.js');
var config = require('./config.json');
var ease = require('./ease.js');

/////  Функция добавления локализации к заболеваниям. Работает по заданной заранее схеме разделения (почему так, а не
// умному - потому что выделение синонимичных симптомов - это отдельная задача и решать ее не охота)

var find_location = function (nodes, arr, ns) {

    for (var i = 0; i < nodes.length; i ++) {
        if ((nodes[i]!=null)&&(ease.IS_DISEASE(nodes[i].type))&&(nodes[i].hasOwnProperty('children'))&&(nodes[i].children != null)) {
            //console.log("Checking location specificy in node #" + i);
            var children_num = nodes[i].children;
            var children_output = [];

            var diseases = []

            for (var j = 0; j < children_num.length; j++) {
                children_output.push(nodes[children_num[j]].name);
            }

            var common = [];
            var arr2 = [];
            var location_specific  = false;
            var null_sites = 0;

            for (var j = 0; j < arr.length; j ++) {
                arr2.push([]);
            }

            for (var j = 0; j < children_num.length; j++) {
                var got = false;
                for (var k = 0; k < arr.length; k++) {
                    if (children_output[j].indexOf(arr[k]) != -1) {
                        got = true;
                        if (ns != undefined) arr2[k].push(children_num[j]);
                        else arr2[k].push(children_output[j]);
                    }

                }

                if (!got) {
                    if (ease.IS_DISEASE(nodes[children_num[j]].type)) {
                        if (ns != undefined) common.push(children_num[j]);
                        else common.push(children_output[j]);
                    } else {
                        if (ns != undefined) diseases.push(children_num[j]);
                        else common.push(children_output[j]);
                    }
                    got = true;
                }
            }


            for (var j = 0; j < arr2.length; j++) {
                if (arr2[j].length == 0) null_sites++;
            }

            if (arr2.length - null_sites > 1) {
                location_specific = true;
            }

            if ((location_specific)&&(ns != undefined)) {
                if (ns.indexOf(i) > -1) {
                    //console.log(nodes[i].name + " -location specific");
                    var new_parents = [];

                    var new_nodes = [];
                    var new_states = JSON.parse(JSON.stringify(nodes[i].states));
                    for (var o = 0; o < new_states.length; o++) {
                        new_states[o].prob = null;
                    }
                    for (var k = 0; k < arr.length; k++) {
                        new_nodes.push({
                            name: nodes[i].name + " (" + arr[k] + ")",
                            type: 0,
                            states: new_states,
                            n: nodes.length + k,
                            doctors: nodes[i].doctors,
                            printable: false,
                            children: [],
                            parents: [{
                                ns: [i],
                                m: [
                                    [1 / arr.length, 1 - 1 / arr.length],
                                    [0, 1]
                                ]}
                            ]
                        })
                    }

                    // добавляет общие симптомы

                    for (var k = 0; k < common.length; k++) {
                        for (var t = 0; t < new_nodes.length; t++) new_nodes[t].children.push(common[k]);

                        var old_parent_index = nodes[common[k]].parents.findIndex((el) => {
                            return el.ns.indexOf(i) > -1;
                        });
                        var old_parent = nodes[common[k]].parents.splice(old_parent_index, 1);
                        for (var t = 0; t < new_nodes.length; t++) {
                            nodes[common[k]].parents.push({
                                ns: [new_nodes[t].n],
                                m: old_parent[0].m
                            })
                        }
                    }

                    // добавляет локальные симптомы


                    for (var m = 0; m < arr2.length; m++) {
                        for (var k = 0; k < arr2[m].length; k++) {
                            new_nodes[m].children.push(arr2[m][k]);

                            var old_parent_index = nodes[arr2[m][k]].parents.findIndex((el) => {
                                return el.ns.indexOf(i) > -1;
                            });
                            var old_parent = nodes[arr2[m][k]].parents.splice(old_parent_index, 1);
                            nodes[arr2[m][k]].parents.push({
                                ns: [new_nodes[m].n],
                                m: old_parent[0].m
                            })

                        }
                    }

                    // добавляет новые заболевания в массив

                    nodes[i].children = [];

                    for (var t = 0; t < new_nodes.length; t++) {
                        nodes.push(new_nodes[t]);
                        var index = nodes.length - 1;
                        nodes[i].children.push(index);
                    }

                    nodes[i].location_specific = true;
                }
            }

        }
    }

    return nodes;
}

var glaz_locations = [0, 1, 11, 18, 36, 62, 63, 65, 84, 91, 122, 131, 147, 151, 156, 162, 204, 221, 232, 240, 244, 245, 248, 255, 258, 266, 276, 282, 286, 300,
    331, 336, 349, 350, 353, 355, 379, 400, 402, 416, 418];

var parts_locations = [2, 27, 35, 37, 40, 41, 47, 48, 50, 55, 58, 59, 85, 121, 134, 144, 148, 159, 173, 184, 202, 216, 228, 230, 239, 247, 268, 277,
345, 346, 363, 364, 368, 370, 377, 385, 403, 406]

function start2 () {
    return new Promise((resolve, reject) => {
        fs.readFile('base.json', {}, (err, data) => {

            data = iconv.decode(data, 'win1251');

            var nodes = JSON.parse(data);

            //nodes = find_location(nodes, ['правый глаз', 'левый глаз'], glaz_locations);
            //nodes = find_location(nodes, ['правая нога', 'левая нога', 'правая рука', 'левая рука'], parts_locations);

            integrity.set_nodes(nodes);

            nodes = integrity.check_integrity(nodes);

            console.log(JSON.stringify(nodes[25]));

            var data = iconv.encode(JSON.stringify({
                'nodes': nodes
            }), 'win1251')

            fs.writeFile('base.refactor.json', data, ()=> {
                //console.log('File base.refactor.json written');
                resolve();
            });
        })
    })

}

module.exports = start2;
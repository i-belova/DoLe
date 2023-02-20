////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////         Перегоняет Excel файл в JSON в соответствующем формате                                               /////
/////                                                                                                              /////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


const excel = require('exceljs');
const fs = require('fs');
const ease = require('./ease.js');
const integrity = require('./integrity.js');
const refactor = require('./refactor.js');
const iconv = require('iconv-lite');
const config = require('./config.json');
const googleapi = require('./googleapi');
var nodes = new Array(3000);
var nodes = [];

function start() {
    return new Promise((resolve, reject) => {
        googleapi.loadBase().then((dby) => {

            //reading nodelist

            var symptoms_citos = [];
            var synonyms = [];

            var nodelist = dby.getWorksheet('dby.3.nodelist');

            var total_nodes = nodelist.rowCount;

            for (let i = 1; i < total_nodes; i++) {
                let row = nodelist.getRow(i);
                let name = row.getCell(2).value;
                if (row.getCell(3).value != "") {
                    synonyms.push({
                        n: Number(row.getCell(5).value),
                        synonym: row.getCell(3).value
                    });
                }
                if (name == null) name = "";
                var tmp_node = {
                    name: name,
                    states: ease.parse_states(row.getCell(4).value),
                    n: Number(row.getCell(5).value),
                    type: Number(row.getCell(6).value),
                    doctors: [row.getCell(8).value]
                };
                var n = Number(row.getCell(5).value);
                nodes[n] = tmp_node;
                if (row.getCell(9) && (Number(row.getCell(9).value) == 1)) {
                    symptoms_citos.push({n: n});
                }
            }

            //reading absolute
            nodelist = null;
            var absolute = dby.getWorksheet('dby.3.absolute');
            var total_lines = absolute.rowCount;

            for (let j = 0; j < total_lines; j++) {

                let row = absolute.getRow(j);
                let n = row.getCell(1).value;

                if (n.hasOwnProperty('formula')) {
                    n = n.result;
                }
                if ((nodes[n] == undefined) || (nodes[n] == null)) {
                } else {
                    var state_name = row.getCell(3).value;
                    var state_prob = row.getCell(4).value;
                    if (typeof state_prob == "string") {
                        state_prob = state_prob.replace(",", ".");
                        state_prob = Number(state_prob);
                    }
                    var state_n = nodes[n].states.findIndex((el) => {
                        return el.name == state_name
                    });
                    if (state_n > -1) {
                        if (nodes[n].states[state_n].hasOwnProperty('prob')) {
                        } else {
                            nodes[n].states[state_n]['prob'] = Number(state_prob);
                            nodes[n].states[state_n]['true'] = Number(state_prob);
                        }
                    }
                }
            }

            absolute = null;

            //reading conditional

            var conditional = dby.getWorksheet('dby.3.conditional');

            var total_rows = conditional.rowCount;

            for (var i = 1; i < total_rows; i++) {
                var row = conditional.getRow(i);

                var parent = row.getCell(2).value;
                var child = row.getCell(5).value;

                if ((child != null) && (parent != null)) {

                    if (parent.hasOwnProperty('formula')) {
                        parent = parent.result;
                    }

                    parent = parent + "";

                    parent = parent.split(";");

                    if (child.hasOwnProperty('formula')) {
                        child = child.result;
                    }

                    var parent_state_string = (row.getCell(4).value + "").split(';');
                    var child_state_string = (row.getCell(7).value + "");
                    var prob = Number(row.getCell(8).value.replace(',', '.'));

                    isClear = true;

                    for (var j = 0; j < parent.length; j++) {
                        parent[j] = Number(parent[j]);

                        if ((nodes[parent[j]] == undefined) || (nodes[parent[j]] == null)) isClear = false;
                    }

                    if ((nodes[child] == undefined) || (nodes[child] == null)) isClear = false;

                    if (isClear) {

                        age_j = -1;

                        for (var j = 0; j < parent.length; j++) {
                            if (nodes[parent[j]].name == "Возраст") {
                                age_j = j;
                                break;
                            }
                        }

                        if (age_j > -1) {
                            var ageResult = getAgeState(nodes[parent[age_j]].states, parent_state_string[age_j]);

                            if (ageResult != -1) {
                                for (var j = 0; j < ageResult.length; j++) {
                                    parent_state_string[age_j] = ageResult[j].str + "";
                                    addM(parent_state_string, child_state_string, parent, child, prob);
                                }
                            }
                        } else {
                            if ((nodes[parent].type < 20) && (nodes[child].type >= 30)) {
                                addM(parent_state_string, child_state_string, parent, child, prob);
                            } else if ((nodes[child].type >= 30) && (child_state_string == "нет")) {

                            } else {
                                addM(parent_state_string, child_state_string, parent, child, prob);
                            }

                        }
                    } else {
                    }
                }
            }

            nodes = refactor.reattach_children(nodes);

            // var synonyms_sheet = dby.getWorksheet('__synonyms');
            // var total_rows = synonyms_sheet.rowCount;
            //
            // let synonyms = [];
            //
            // for (let i = 1; i <= total_rows; i++) {
            //     var item = synonyms_sheet.getRow(i);
            //     let n = item.getCell(1).value;
            //     let synonym = item.getCell(3).value;
            //
            //     if (synonym) {
            //         synonyms.push({
            //             n: n,
            //             synonym: synonym
            //         });
            //     }
            // }
            //
            for (let i = 0; i < synonyms.length; i++) {
                 var item = synonyms[i];
                 if (nodes[item.n]) nodes[item.n].name = item.synonym;
            }



            let data = JSON.stringify(nodes);

            data = iconv.encode(data, 'win1251');

            fs.writeFile("base.json", data, () => {
                console.log("base.json written");
                resolve();
            });

            // let synonyms_json = JSON.stringify({items: synonyms});
            //
            // synonyms_json = iconv.encode(synonyms_json, 'win1251');
            //
            // fs.writeFile("synonyms.json", synonyms_json, () => {
            //     console.log("synonyms.json written");
            //
            // });

            fs.writeFile("symptoms_citos.json", iconv.encode(JSON.stringify({items: symptoms_citos}), 'win1251'), () => {
                console.log("symptoms_citos.json written");
                resolve();
            });
        })


    });
}

var createNullMatrix = function (dims) {
    var m = null;
    if (dims.length == 0) return null;
    m = new Array(dims[0]);
    for (var i = 0; i < m.length; i++) {
        m[i] = createNullMatrix(dims.slice(1));
    }
    return m;
}

var setElementInMatrix = function (m, state, value) {
    if (state.length > 0) {
        m[state[0]] = setElementInMatrix(m[state[0]], state.slice(1), value);
        return m;
    } else {
        return value;
    }
}

var addM = function (parent_state_string, child_state_string, parent, child, prob) {

    var dims = [];

    for (var i = 0; i < parent.length; i++) dims.push(nodes[parent[i]].states.length);
    dims.push(nodes[child].states.length);

    var m = createNullMatrix(dims);

    var isClear = true;

    var parent_state_index = [];

    for (var i = 0; i < parent_state_string.length; i++) {
        parent_state_index.push(ease.get_state_index(nodes[parent[i]], parent_state_string[i].toLowerCase()))
        if (parent_state_index[parent_state_index.length - 1] == -1) isClear = false;
    }

    var child_state_index = ease.get_state_index(nodes[child], child_state_string.toLowerCase());
    if (child_state_index == -1) isClear = false;

    var m_state = parent_state_index;
    m_state.push(child_state_index);

    if (!isClear) {
    } else {


        if ((ease.IS_DISEASE(nodes[child].type))
            && (nodes[parent].type != config.TYPE.DISEASE_ADD)
            && (nodes[parent].type != config.TYPE.DISEASE_MUL)
            && (prob != 0) && (prob != 1)) {
            prob = prob / 14;
        }

        m = setElementInMatrix(m, m_state, prob);

        if (!nodes[child].hasOwnProperty('parents')) {
            nodes[child].parents = [];
            nodes[child].parents.push({
                "ns": parent,
                "m": m
            });
        } else {
            var par = nodes[child].parents.findIndex((el) => {
                if (el.ns.length > 1) {
                }
                return ease.compareArrays(el.ns, parent);
            });
            if (par > -1) {
                nodes[child].parents[par].m = setElementInMatrix(nodes[child].parents[par].m, m_state, prob);
            } else {
                nodes[child].parents.push({
                    "ns": parent,
                    "m": m
                })
            }
        }
    }
}

var ageStates = null;

var getAgeState = function (states, input) {
    if (ageStates == null) {
        ageStates = [];
        for (var i = 0; i < states.length; i++) {
            ageStates.push(parseAgeState(states[i].name));
        }
    }

    var input = parseAgeState(input);

    if (input == undefined) {
        return -1;
    }

    var result = [];

    for (var i = 0; i < ageStates.length; i++) {
        if ((ageStates[i].bottom >= input.bottom) && (ageStates[i].top <= input.top)) {
            result.push(ageStates[i]);
        }
    }

    return result;
}

var parseAgeState = function (input) {

    if (input.indexOf(">") > -1) {
        var bottom = Number(input.replace(">", ''));

        return {
            'bottom': bottom,
            'top': 999,
            'str': input
        };
    }

    if (input.indexOf("<") > -1) {
        var top = Number(input.replace("<", ''));

        return {
            'bottom': 0,
            'top': top,
            'str': input
        };
    }

    if (input.indexOf("-") > -1) {
        var bottom = Number(input.split("-")[0]);
        var top = Number(input.split("-")[1]);

        return {
            'bottom': bottom,
            'top': top,
            'str': input
        };
    }
}

module.exports = start;
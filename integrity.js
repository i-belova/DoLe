////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////         Модуль ответственный за предобработку базы данных для ее последующей записи в Монго                  /////
/////         сделано для того, чтобы снять эту задачу с приложения                                                /////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var config = require('./config.json');
var ease = require('./ease');
var nodes;

var check_integrity = function () {

    //// Добивает абсолютные вероятности состояний до общей вероятности всех исходов события в 1
    nodes = check_absolute_probs(nodes);



    ///// Перепроверка и дополнения условных вероятностей там, где это возможно (где в одной строке матрицы не более одного 0)

    ///// Нормировка абсолютных вероятностей заболеваний, чтобы в сумме по всей сети получалась 1, иначе получается, что
    // каждый человек в среднем болен 14ю заболеваниями
    norm_absolute_probs();



    check_connection1();
    ///// Дополнение условных вероятностей, там, где их вообще нет (общий случай, для состояния заболевания "нет"
    // условных вероятностей нет, так быть не должно). Везде в таких случаях проставляются просто абслютные вероятности

    check_connections();

    check_connection1();
    //console.log(JSON.stringify(nodes[483]));

    recheck_symptoms_probs();

    check_duplicates();

    return nodes;
};

var recheck_symptoms_probs = function() {
    for (let i = 0; i < nodes.length; i++) {
        if ((nodes[i] != null) && (nodes[i].type == 30) && (nodes[i].parents != undefined)) {
            for (let j = 0 ; j < nodes[i].parents.length; j++) {
                if (nodes[i].parents[j].ns.length == 1) {
                    let m = nodes[i].parents[j].m[1];
                    m[1] = Math.pow(m[1], 1 / nodes[i].parents.length);
                    m[0] = 1 - m[1];
                    nodes[i].parents[j].m[1] = m;
                } else {
                    console.log("More than one parent in list;");
                }
            }
        }
    }
};

var check_duplicates = function () {
    var counter = 0;
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if ((node != null)&&(node.parents != undefined)) {
            for (var j = 0; j < node.parents.length; j++) {
                var parent1 = node.parents[j];
                if (j + 1 < node.parents.length) {
                    for (var k = j + 1; k < node.parents.length; k++) {
                        var parent2 = node.parents[k];
                        var intersect = ease.checkIntersect(parent1.ns, parent2.ns);
                        if (intersect.bool) {
                            counter++;
                            //console.log(parent1, parent2, intersect);
                        }
                    }
                }
            }
        }
    }
    //console.log("INTERSECTION COUNTER: ", counter);
}
///// Проверка абсолютных вероятностей. Надо чтобы везде их сумма была равна 1. Недостающие заполнить

var check_absolute_probs = function () {
    for (var i = 0; i < nodes.length; i++) {
        if ((nodes[i] != undefined)&&(nodes[i]!=null)) {
            //console.log("Checking integrity for node #" + i);
            var total_prob = 0;
            let total_true = 0;
            var total_nulls = 0;
            let total_true_nulls = 0;
            var null_state = -1;
            let null_true_state = 0;
            for (var j = 0; j < nodes[i].states.length; j++) {
                if (nodes[i].states[j].hasOwnProperty('prob')) {
                    if (nodes[i].states[j].prob != 0) {
                        total_prob += nodes[i].states[j].prob;
                    } else {
                        total_nulls++;
                        null_state = j;
                    }
                } else {
                    total_nulls++;
                    null_state = j;
                }
                /// For true states
                if (nodes[i].states[j].hasOwnProperty('true')) {
                    if (nodes[i].states[j].true != 0) {
                        total_true += nodes[i].states[j].true;
                    } else {
                        total_true_nulls++;
                        null_true_state = j;
                    }
                } else {
                    total_true_nulls++;
                    null_true_state = j;
                }
            }

            if (total_nulls == 1) {
                nodes[i].states[null_state].prob = 1 - total_prob;
                //console.log("Adding one state probability for node #" + i);
            } else if (total_nulls == 2) {
                //console.log("Error in node #" + i + ": more than one states without probability");
            } else {
                //console.log("total_nulls = " + total_nulls);
            }

            if (total_true_nulls == 1) {
                nodes[i].states[null_true_state].true = 1 - total_true;
                //console.log("Adding one state probability for node #" + i);
            } else if (total_true_nulls == 2) {
                //console.log("Error in node #" + i + ": more than one states without probability");
            } else {
                //console.log("total_nulls = " + total_nulls);
            }
        }
    }

    nodes = nodes;


    return nodes;
}

var iterate_parents2 = function (parent, i, parent_state = 0) {

    if (parent.ns.length == 0) {
        var overall_p = 0;
        var nulls = 0;
        var null_j = 0;

        for (var j = 0; j < parent.m.length; j++) {
            //changes made to prevent misunderstanding of 'null's and true nulls, derived from base
            //if ((parent.m[j] == 0)||(parent.m[j] == null)||(parent.m[j] == undefined)) {
            if ((parent.m[j] == null)||(parent.m[j] == undefined)) {
                nulls++;
                null_j = j;
            } else {
                overall_p += parent.m[j];
            }
        }

        if ((overall_p < 1)&&(nulls < 2)) {
            parent.m[null_j] = 1 - overall_p;
        }
            //console.log(overall_p, nulls, parent.m);
            //Обаязка для уменьшения в 2 раза всех вероятностей от нулевых родителей
        if ((overall_p == 0)&&(nulls == 2)) {
            for (var j = 0; j < parent.m.length; j++) {
                // if (parent_state == 0) {
                //     parent.m[j] = nodes[i].states[j].prob;
                // } else {
                //     parent.m[j] = Math.pow(nodes[i].states[j].prob, 1/2);
                // }
                parent.m[j] = nodes[i].states[j].prob;
                if (nodes[i].states[j].prob == undefined) parent.m[j] = undefined;
            }
        }
        if ((overall_p == 1)&& (nulls > 0)) {
            parent.m[null_j] = 0;
        }
        return parent;
    }

    var print = false;
    if (parent.ns.length > 1) {
        //console.log(parent.ns);
        print = true;
    }

    var par = nodes[parent.ns[0]];
    var ns_copy = parent.ns[1];
    var ns_splice = parent.ns.splice(1);

    if (print) {
        //console.log(ns_splice, ns_copy, parent.ns);
    }

    for (var k = 0; k < par.states.length; k++) {
        //console.log("ns",ns_splice);
        parent.m[k] = iterate_parents2({
            'ns': ns_splice,
            'm': parent.m[k]
        }, i, k).m;
    };

    if (print) {
        parent.ns.push(ns_copy)
    }

    return parent;
}

var check_connection1 = function () {
    for (var i = 0; i < nodes.length; i++) {
        if ((nodes[i] != undefined) && (nodes[i] != null)) {
            if (nodes[i].hasOwnProperty('parents')&&(nodes[i].parents.length > 0)) {
                for (var j = 0; j < nodes[i].parents.length; j++) {
                    nodes[i].parents[j] = iterate_parents2(nodes[i].parents[j], i);
                }
            }
        }
    }
}

var check_connections = function () {
for (var i = 0; i < nodes.length; i++) {
    if ((nodes[i] != undefined) && (nodes[i] != null)) {
        if (nodes[i].hasOwnProperty('parents')&&(nodes[i].parents.length > 0)) {
            if (nodes[i].states.length == 2) {
                if (((nodes[i].states[0].prob == undefined)||(nodes[i].states[0].prob == null))&&((nodes[i].states[1].prob == undefined)||(nodes[i].states[1].prob == null))) {
                    var p0 = get_parents_probs(i, 0, true);
                    if ( i == 1082) {
                        p0 = get_parents_probs(i, 0, true);
                    }
                    var p1 = 1 - p0;
                    //console.log(nodes[i].name  + " - " + p0 + " - ")
                    //console.log(nodes[i].name + " : " + p0 + " - " + p1);
                    nodes[i].states[0].prob = p0;
                    nodes[i].states[1].prob = p1;
                }
            }
        }
    }
}
}

///// параметр exclusive отвечает за способ вычисления вероятности. exclusion = true применяется для состояний "да", для которых
///// достаточно только 1 причины для возникновения события, вычисляется вероятность дополнительного события.
///// exclusion = false применяется для событий "нет", необходимо, чтобы все возможные причины события одновременно совпали в "нет"

///// parents = [{"ns": [1, 2], "m": [[[]]]}, ... {}]
///// ns - номера родительских узлов, от которых зависит состояние текущего узла, длина - n (одновеременных узлов, участвующих в расчете вероятности)
///// m - n + 1 мерная матрица вероятностей, где размерности по порядку: состояния 1 го узла в ns, 2го узла в ns ..., самого расчетного узла

var get_parents_probs = function (i, state, exclusive) {
    var p = 0;
    var _p = 1;
    for (var j = 0; j < nodes[i].parents.length; j++) {
        if (exclusive) {
            _p = _p * (1 - iterate_parents(nodes[i].parents[j], state, exclusive));
            //console.log(nodes[i].parents[j].ns + " - " + _p);
        }
    }

    if (exclusive) {
        return 1 - _p;
    }
}

var iterate_parents = function (parent, i, exclusive) {
    if (parent.ns.length == 0) {
        if (parent.m[i] != null) {
            return parent.m[i];
        } else return 0;
    }
    if (exclusive) {
        var p = 0;
        var parent_node = nodes[parent.ns[0]];
        for (var j = 0; j < parent_node.states.length; j++) {
        //for (var j = 0; j < 1; j++) {
            if ((parent_node.states[j].prob != undefined)&&(parent_node.states[j].prob != null)) {
                p = p + iterate_parents({
                        'ns': parent.ns.splice(1),
                        'm': parent.m[j]
                    }, i, exclusive) * parent_node.states[j].prob;
            }
        }

        return p;
    }
}

var norm_absolute_probs = function () {
    var overall_p = 0;

    for (var i = 0; i < nodes.length; i++) {
        if ((nodes[i] != undefined)&&(nodes[i]!= null)) {
            if (nodes[i].type == config.TYPE.DISEASE) {
                if (nodes[i].states[0].prob != undefined) {
                    overall_p += nodes[i].states[0].prob;
                }
            }
        }
    }

    for (var i = 0; i < nodes.length; i++) {
        if ((nodes[i] != undefined)&&(nodes[i]!= null)) {
            if (nodes[i].type == config.TYPE.DISEASE) {
                if (nodes[i].states[0].prob != undefined) {
                    nodes[i].states[0].prob = nodes[i].states[0].prob / overall_p;
                    nodes[i].states[1].prob = 1 - nodes[i].states[0].prob;
                }
            }
        }
    }

    return;
}

var set_nodes = function (input_nodes) {
    nodes = input_nodes;
}

module.exports.set_nodes = set_nodes;
module.exports.check_integrity = check_integrity;
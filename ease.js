const
    config = require('./config.json');

var parse_states = function (states) {
    if ((states == undefined)||(states == null)) {
        return [];
    }
    var states = states.split(';');
    if (states[states.length - 1] == "") {
        states = states.splice(0, states.length - 1)
    }
    var result = [];
    for (var j = 0; j < states.length; j ++ ) {
        result.push({
            name: states[j]
        });
    }
    return result;
};

var get_state_index = function (node, state) {
    return node.states.findIndex((el) => {
        return (el.name == state);
    })
};

var compareArrays = function (arr1, arr2) {
    var equal = true;
    if (arr1.length == arr2.length) {
        for (var i = 0; i < arr1.length; i++) {
            if (arr1.indexOf(arr2[i]) < 0) return false;
        }
    } else {
        return false;
    }

    return true;
};

var checkIntersect = function(arr1, arr2) {
    var intersect = false;
    var arr = []

    for (var i = 0; i < arr1.length; i++) {
        arr.push(arr2.indexOf(arr1[i]));
        if (arr[i] > -1) intersect = true;
    }

    return {
        'bool': intersect,
        'arr': arr
    }
};

var IS_DISEASE = function (i) {
    if ((i == config.TYPE.DISEASE)||(i == config.TYPE.DISEASE_ADD)||(i == config.TYPE.DISEASE_MUL)) {
        return true;
    }
    return false;
};

var IS_SYMPTOM = function (i) {
    if ((i == config.TYPE.SYMPTOM)||(i == config.TYPE.SYMPTOM_FORCE)||(i == config.TYPE.SYMPTOM_NONFORCE)) {
        return true;
    }
    return false;
};

var IS_PARAM = function (i) {
    if ((i == config.TYPE.PARAM)) {
        return true;
    }
    return false;
};

module.exports.parse_states = parse_states;
module.exports.get_state_index = get_state_index;
module.exports.compareArrays = compareArrays;
module.exports.checkIntersect = checkIntersect;
module.exports.IS_DISEASE = IS_DISEASE;
module.exports.IS_SYMPTOM = IS_SYMPTOM;
module.exports.IS_PARAM = IS_PARAM;
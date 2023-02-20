/**
 * Created by Halck on 05.10.2018.
 */
const
    fs = require('fs'),
    iconv = require('iconv-lite');

var nodes = [];

var get_new_probs = function (old_probs, diff) {
    var overall_prob = 0;

    for (var j = 0; j < diff.length; j++) {
        if ((diff[j] != undefined) && (diff[j] != null) && (diff[j] != 0)) {
            old_probs[j] = old_probs[j] * diff[j];
        }
        overall_prob += old_probs[j];
    }



    for (var j = 0; j < diff.length; j++) {
        old_probs[j] = old_probs[j] / overall_prob;
    }

    return old_probs;
};

var iterate_parents = function (ns, M, diff) {

    if (ns.length == 0) {
        return get_new_probs(M, diff);
    } else {
        var ns_in = ns.splice(1);
        for (var i = 0; i < M.length; i++) {
            M[i] = iterate_parents(ns_in, M[i], diff);
        }

        return M;
    }
};

var read_adjusted_states = function (callback) {
    fs.readFile('adjusted_states.txt', 'utf8', function (err, contents) {
        if (err) {
            //console.log("Error during file reading");
        }

        var data = [];

        var lines_regex = /(n.+(\n|\r))/gm;

        var lines = contents.match(lines_regex);

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var n_regex = /(n:(\d+))/;
            var n = Number(line.match(n_regex)[2]);
            var prob_regex = /(\d\.\d+((?=\d\.)|(?=\r)))/gm;
            var probs = line.match(prob_regex);
            for (var j = 0; j < probs.length; j++) {
                probs[j] = Number(probs[j]);
            }

            data.push({
                "n": n,
                "probs": probs
            });
        }

        for (var i = 0; i < data.length; i++) {


            var dt = data[i];
            if (dt.probs.length > 2) {
                //console.log("WARNING: UNEXPECTED NUMBER OF STATES");
            }

            var n = dt.n;

            if (nodes[n] != undefined) {
                var old_probs = nodes[n].states;
                var new_probs = dt.probs;

                var diff = [];

                for (var j = 0; j < old_probs.length; j++) {
                    diff.push(new_probs[j] / old_probs[j].prob);
                }

                //change own states
                var old_probs_input = [];
                for (var j = 0; j < old_probs.length; j++) {
                    old_probs_input.push(old_probs[j].prob);
                }

                old_probs_input = get_new_probs(old_probs_input, diff);

                for (var j = 0; j < old_probs.length; j++) {
                    nodes[n].states[j].prob = old_probs_input[j];
                }

                if ((nodes[n].parents != undefined) && (nodes[n].parents != null)) {
                    for (var p = 0; p < nodes[n].parents.length; p++) {
                        nodes[n].parents[p].m = iterate_parents(nodes[n].parents[p].ns, nodes[n].parents[p].m, diff);
                    }
                }
            }
        }

        var data = iconv.encode(JSON.stringify({
            'nodes': nodes
        }), 'win1251');

        fs.writeFile('base.refactor.exp.json', data, () => {
            callback();
        });

    });

}

var read_current_base = function (callback) {
    fs.readFile('base.refactor.json', {}, (err, data) => {

        data = iconv.decode(data, 'win1251');

        nodes = JSON.parse(data).nodes;

        read_adjusted_states(callback);
    })
};

function start3() {
    return new Promise((resolve, reject) => {
        read_current_base(resolve);
    });
}

if (require.main == module) {
    console.log("runned in command line");
    start3();
}

module.exports = start3;

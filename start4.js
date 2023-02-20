const fs = require('fs');
const iconv = require('iconv-lite');

var write_nodelist = function (nodes, callback_resolve) {
    var nodelist = [];
    for (let i = 0; i < nodes.length; i++) {
        function get_states_from_node(node) {
            var result = "";
            for (let i = 0; i < node.states.length; i++) {
                var item = node.states[i];
                result += item.name + ';';
            }
            return result;
        }

        function push() {
            nodelist.push({
                "name": nodes[i].name,
                "num": nodes[i].n,
                "states": get_states_from_node(nodes[i]),
                "type": nodes[i].type
            });
        }

        if (nodes[i] != null) {
            if (nodes[i].type < 30) push();
            if ((nodes[i].type >= 30)&&(nodes[i].parents != undefined)&&(nodes[i].parents.length > 0)) push();
        }

    }

    var doctors_list = [];

    for (let i = 0; i < nodes.length; i++) {
        var item = nodes[i];
        if (item == null) continue;
        if ((item.type >= 20)&&(item.type < 30)) {
            if (item.doctors[0] != null) {
                doctors_list.push({
                    name: item.name,
                    doctor: item.doctors[0]
                });
            }
        }
    }

    fs.writeFile("nodelist.json", iconv.encode(JSON.stringify({
        'nodes': nodelist
    }), 'utf-8'), () => {
        fs.writeFile("doctors.json", iconv.encode(JSON.stringify({
            'items': doctors_list
        }), 'utf-8'), () => {
            callback_resolve();
            console.log('doctors.json file created');
        })
        console.log('nodelist.json file created');
    })
};

var reparse_filters = async function (callback, callback_resolve) {

    let nodes_for_filtering_nums = [1837, 1759];

    let nodes_filtered = [];

    let symptoms_to_filter = [];

    nodes.forEach((node) => {
        if ((node)&&(node.parents)) {
            nodes_for_filtering_nums.forEach((node_for_filtering_num) => {
                let index = node.parents.findIndex((el) => {
                    return (el.ns.length == 1) && (el.ns[0] == node_for_filtering_num);
                });
                if ((index != undefined) && (index != null) && (index >= 0)) {
                    let potent_parent = node.parents[index];
                    for (let i = 0; i < potent_parent.m.length; i++) {
                        if (potent_parent.m[i][0] == 0) {
                            if (node.type >= 30) {
                                nodes_filtered.push({
                                    node: node,
                                    parent: node_for_filtering_num,
                                    parent_state: i
                                });
                            } else if ((node.type >= 20)&&(node.type < 30)) {
                                if (node.children) {
                                    node.children.forEach((el) => {
                                        
                                        let diseases_in_parents = 0;
                                        nodes[el].parents.forEach((parent) => {
                                            if ((nodes[parent.ns[0]].type >= 20) &&((nodes[parent.ns[0]].type < 30))) diseases_in_parents++;
                                        });

                                        if ((nodes[el].type >= 30 )&&(diseases_in_parents == 1)) {
                                            nodes_filtered.push({
                                                node: nodes[el],
                                                parent: node_for_filtering_num,
                                                parent_state: i
                                            });
                                        }
                                    });
                                }
                            }
                            
                        }
                    }
                }
            })
        }
    });

    nodes_filtered.forEach((el) => {
        let node = el.node;
        let parent_index = el.parent;
        let parent_state_index = el.parent_state;

        //Отфильтровать симптомы
        if ((node.type >= 30)&&(nodes[parent_index].type < 20)) {
            symptoms_to_filter.push({
                num: nodes[parent_index].n,
                name: nodes[parent_index].name,
                state: nodes[parent_index].states[parent_state_index].name,
                _num: node.n,
                _name: node.name
            });
        }
    });

    return new Promise(resolve => {
    fs.writeFile('nodelist_filters.json', iconv.encode(JSON.stringify({filters: symptoms_to_filter}), 'utf-8'), () => {
        console.log("nodelist_filters.json created");
        resolve();
    });
});
    //console.log(symptoms_to_filter);
};

var read_current_base = async function (callback, callback_resolve) {
    await fs.readFile('base.refactor.exp.json', {}, async (err, data) => {

        data = iconv.decode(data, 'win1251');

        nodes = JSON.parse(data).nodes;

        await reparse_filters(nodes, () => {});

        await callback(nodes, callback_resolve);
    })
};

async function start4() {
    return new Promise((resolve, reject) => {
        read_current_base(write_nodelist, resolve);
    });
}

start4();

module.exports = start4;
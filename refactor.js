

var reattach_children = function (nodes) {
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        //console.log('Reattaching children for node #' + i);
                        if ((node!=undefined)&&(node != null)) {
                            if (node.hasOwnProperty('parents') && (node.parents.length)) {
                                for (var j = 0; j < node.parents.length; j++) {
                                    var parent = node.parents[j];
                                    for (var k = 0; k< parent.ns.length; k ++) {
                                        var par = parent.ns[k]
                                        //console.log(par,k, parent.ns);
                                        if (!nodes[par].hasOwnProperty('children')) {
                                            nodes[par].children = [];
                                        }

                                        nodes[par].children.push(node.n);
                    }
                }
            }
        }
    }

    return nodes;
}



module.exports.reattach_children = reattach_children;

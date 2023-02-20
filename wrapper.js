const start = require('./start.js');
const start2 = require('./start2.js');
const start3 = require('./start3.js');
const start4 = require('./start4.js');
const start5 = require('./start5.js');

var reparse = function () {
    return new Promise((resolve, reject) => {
        start().then(() => {
            start2().then(()=>{
                start3().then(() => {
                    console.log('Database parsed');
                    resolve();
                });
            });
        })
    });
};

var reparse_async = async function () {
    return new Promise( async (resolve, reject) => {
        try {
            await start();
            await start2();
            await start3();
            await start4();
            await start5();
            console.log("Database parsed!");
        } catch (ex) {
            console.log("Some error occurred during data parsing!");
            reject(ex);
        }
        resolve("ok");
    });
}

var reparse_nodelist = function () {
    return new Promise((resolve, reject) => {
        start4().then(() => {
            console.log('Nodelist parsed');
            resolve();
        });
    });
};

if (require.main == module) {
    console.log("runned in command line");
    reparse_async();
}

module.exports.reparse = reparse;
module.exports.reparse_nodelist = reparse_nodelist;
module.exports.reparse_async = reparse_async;
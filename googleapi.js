const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(JSON.parse(content), listMajors);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function listMajors(auth) {

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////           Объявление переменных и методов нового АПИ //////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let base, row, sheet;

class Cell {
    constructor(value) {
        this.value = value;
    }
}

class Row {
    constructor(row) {
        this.value = row;
    }
    getCell(i) {
        let ii = i - 1;
        if (ii < this.value.length) {
            return new Cell(this.value[ii]);
        } else {
            return new Cell(null);
        }
    }
}

class Sheet {
    constructor(sheet) {
        this.value = sheet;
        for (let i = this.value.length-1; i >= 0; i--) {
            let isNull = true;
            for (let j = 0; j < this.value[i].length; j ++) {
                if (this.value[i][j] != '') {
                    isNull = false;
                    break;
                }
            }
            if (!isNull) {
                this.rowCount = i;
                break;
            }
        }
    };

    getRow(i) {
        if (i <= this.rowCount) {
            return new Row(this.value[i]);
        }
    }
}

class Base {
    constructor () {
        this.sheets = {};
    }
    setSheet(name, data) {
        this.sheets[name] = new Sheet(data.data.values);
    }
    getWorksheet (sheet_name) {
        return this.sheets[sheet_name];
    }
};



var sheets = {
    'dby.3.nodes': {},
    'dby.3.conditional': {},
    'dby.3.absolute': {}
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////           Функция загрузки файла                     //////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var loadBase = function (auth) {

    base = new Promise((resolve, reject) => {

        let loadSheet = function(name, sheets) {

            return new Promise((resolve1, reject1) => {

                sheets.spreadsheets.values.get({
                    spreadsheetId: '1xCmJKgoflwbwJlQlXb2WjgaB091WXeoCDAckFYqkPtI',
                    range: name + "!A:I"
                }, (err, res) => {
                    if (res != undefined) {
                        base.setSheet(name, res);
                    }
                    resolve1();
                });
            })
        }

        let loadBaseHandler = function (auth) {
            const sheets = google.sheets({version: 'v4', auth});
            base = new Base();
            loadSheet('dby.3.nodelist', sheets).then(()=>{
                 loadSheet('dby.3.conditional', sheets).then(()=> {
                     loadSheet('dby.3.absolute', sheets).then(()=> {
                         //loadSheet('__synonyms', sheets).then(()=> {
                             resolve(base);
                         //});
                     });
                 })
            });
        }

        fs.readFile('credentials.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Google Sheets API.
            authorize(JSON.parse(content), loadBaseHandler);
        });
    });
    return base;
}

module.exports.loadBase = loadBase;
module.exports.base = base;
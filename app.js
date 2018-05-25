let express = require('express');
let bodyParser = require('body-parser');
let app = express();

app.use(express.static('public'));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

/* ------------------------------------ 分割线 ------------------------------------ */

const commonLogger = require('./pomeloClient/logger/loggers')(__filename).commonLogger;
const PomeloClient = require('./pomeloClient/newPomeloClient');
const client = new PomeloClient();

const MANAGER = {
    ip: '127.0.0.1',
    port: 3041
};

const updateSD = function(SDName, jsonStr) {
    let router = 'manager.managerHandler.updateSD';
    let msg = {
        SDName,
        jsonStr
    };
    return client.requestPromise(router, msg).then(function (result) {
        commonLogger.debug('this is result for router updateSD:', result);
        return result;
    });
};

const getSD = function(SDName) {
    let router = 'manager.managerHandler.getSD';
    let msg = {
        SDName
    };
    return client.requestPromise(router, msg).then(function (result) {
        commonLogger.debug('this is result for router getSD:', result);
        return result;
    });
};

/* ------------------------------------ 分割线 ------------------------------------ */

app.post('/login', function(req, res) {
    
    console.log( req.body.username );
    console.log( req.body.password );
    
    res.send('someone want login');
});

app.get('/getSD', function (req, res) {
    client.connectPromise(MANAGER.ip, MANAGER.port)
    .then(() => getSD(req.query.SDName))
    .then((response) => {
        res.send(response);
    });
});

app.post('/updateSD', function(req, res) {
    client.connectPromise(MANAGER.ip, MANAGER.port)
    .then(() => updateSD(req.body.SDName, JSON.stringify(req.body.jsonStr)))
    .then((response) => {
        commonLogger.debug( `client.connectPromise(${ MANAGER.ip }, ${ MANAGER.port })`, response );
        res.send(response);
    });
});

let server = app.listen(3000, function () {
    let host = server.address().address;
    let port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});

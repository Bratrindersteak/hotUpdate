/* global WebSocket: true */
'use strict';
var _ = require('underscore');
var WebSocket = require('ws');
var assert = require('assert');
var util = require('util');
var crypto = require('crypto');
var Protocol = require('pomelo-protocol');
var Package = Protocol.Package;
var Message = Protocol.Message;
var protobuf = require('pomelo-protobuf');
var EventEmitter = require('events').EventEmitter;

var JS_WS_CLIENT_TYPE = 'js-websocket';
var JS_WS_CLIENT_VERSION = '0.0.1';

var RES_OK = 200;
var RES_OLD_CLIENT = 501;

var encrypt = require('../encrypt/encrypt.js');
var encryptConfig = require('../encrypt/encryptConfig.json');
var USE_ENCRYPT_RESPONSE = encryptConfig.USE_ENCRYPT_RESPONSE;
var USE_ENCRYPT_REQUEST = encryptConfig.USE_ENCRYPT_REQUEST;
var USE_ENCRYPT_PUSH = encryptConfig.USE_ENCRYPT_PUSH;
var ENCRYPT_INFO = encryptConfig.ENCRYPT_INFO;
var PUSH_ENCRYPT_INFO = encryptConfig.PUSH_ENCRYPT_INFO;

var Pomelo = function(opts) {
  EventEmitter.call(this);
  opts = opts || {};
  this.isInit = false;
  this.socket = null;
  this.reqId = 0;
  this.callbacks = {};
  this.handlers = {};
  this.routeMap = {};

  this.heartbeatInterval = 10000;
  this.heartbeatTimeout = this.heartbeatInterval * 2;
  this.nextHeartbeatTimeout = 0;
  this.gapThreshold = 100; // heartbeat gap threshold
  this.heartbeatId = null;
  this.heartbeatTimeoutId = null;

  this.handshakeCallback = null;

  this.initCallback = null;

  this.handshakeBuffer = {
    'sys': {
      type: JS_WS_CLIENT_TYPE,
      version: JS_WS_CLIENT_VERSION,
    },
    'user': {},
  };
  this.handlers[Package.TYPE_HANDSHAKE] = this.handshake.bind(this);
  this.handlers[Package.TYPE_HEARTBEAT] = this.heartbeat.bind(this);
  this.handlers[Package.TYPE_DATA] = this.onData.bind(this);
  this.handlers[Package.TYPE_KICK] = this.onKick.bind(this);
  this.encryptConfig = encryptConfig;
};

util.inherits(Pomelo, EventEmitter);

Pomelo.prototype.init = function(params, cb) {
  this.isInit = true;
  this.params = params;
  params.debug = true;
  this.initCallback = cb;
  var host = params.host;
  var port = params.port;

  var url = 'ws://' + host;
  if (port) {
    url += ':' + port;
  }

  if (!params.type) {
    this.handshakeBuffer.user = params.user;
    this.handshakeCallback = params.handshakeCallback;
    this.initWebSocket(url, cb);
  }
};

Pomelo.prototype.initWebSocket = function(url, cb) {
  var self = this;
  var onopen = function(event) {
    var obj = Package.encode(Package.TYPE_HANDSHAKE,
        Protocol.strencode(JSON.stringify(self.handshakeBuffer)));
    self.send(obj);
  };
  var onmessage = function(event) {
    self.processPackage(Package.decode(event.data), cb);
    // new package arrived, update the heartbeat timeout
    if (self.heartbeatTimeout) {
      self.nextHeartbeatTimeout = Date.now() + self.heartbeatTimeout;
    }
  };
  var onerror = function(event) {
    self.emit('io-error', event);
  };
  var onclose = function(event) {
    self.emit('close', event);
  };
  this.socket = new WebSocket(url);
  this.socket.binaryType = 'arraybuffer';
  this.socket.onopen = onopen;
  this.socket.onmessage = onmessage;
  this.socket.onerror = onerror;
  this.socket.onclose = onclose;
};

Pomelo.prototype.disconnect = function() {
  this.isInit = false;
  if (this.socket) {
    if (this.socket.disconnect) this.socket.disconnect();
    if (this.socket.close) this.socket.close();
    this.socket = null;
  }

  if (this.heartbeatId) {
    clearTimeout(this.heartbeatId);
    this.heartbeatId = null;
  }
  if (this.heartbeatTimeoutId) {
    clearTimeout(this.heartbeatTimeoutId);
    this.heartbeatTimeoutId = null;
  }
};

Pomelo.prototype.request = function(route, msg, cb) {
  var userId = this.user && this.user.userid ? this.user.userid : '';
  msg = msg || {};
  route = route || msg.route;
  if (!route) {
    return;
  }
  this.reqId++;
  var self = this;
  self.sendMessage(self.reqId, route, msg);
  self.callbacks[self.reqId] = cb;
  self.routeMap[self.reqId] = route;
};

Pomelo.prototype.notify = function(route, msg) {
  msg = msg || {};
  this.sendMessage(0, route, msg);
};

Pomelo.prototype.sendMessage = function(reqId, route, msg) {
  if (USE_ENCRYPT_REQUEST) {
    var encryptionFields = ENCRYPT_INFO[route];
    if (!!encryptionFields) {
      var length = encryptionFields.length;
      for (var i = 0; i < length; i++) {
        msg[encryptionFields[i]] = encrypt.create(msg[encryptionFields[i]]);
      }
    }
  }

  var type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY;
  //compress message by protobuf
  var protos = !!this.data.protos ? this.data.protos.client : {};
  if (!!protos[route]) {
    msg = protobuf.encode(route, msg);
  } else {
    msg = Protocol.strencode(JSON.stringify(msg));
  }

  var compressRoute = 0;
  if (this.dict && this.dict[route]) {
    route = this.dict[route];
    compressRoute = 1;
  }
  msg = Message.encode(reqId, type, compressRoute, route, msg);
  var packet = Package.encode(Package.TYPE_DATA, msg);
  this.send(packet);
};

Pomelo.prototype.send = function(packet) {
  if (!!this.socket) {
    this.socket.send(packet, {
      binary: true,
      mask: true,
    });
  }
};

Pomelo.prototype.heartbeat = function(data) {
  var obj = Package.encode(Package.TYPE_HEARTBEAT);
  if (this.heartbeatTimeoutId) {
    clearTimeout(this.heartbeatTimeoutId);
    this.heartbeatTimeoutId = null;
  }

  if (this.heartbeatId) {
    // already in a heartbeat interval
    return;
  }

  var self = this;
  this.heartbeatId = setTimeout(function() {
    self.heartbeatId = null;
    self.send(obj);

    self.nextHeartbeatTimeout = Date.now() + self.heartbeatTimeout;
    self.heartbeatTimeoutId = setTimeout(self.heartbeatTimeoutCb.bind(self),
        self.heartbeatTimeout);
  }, self.heartbeatInterval);
};

Pomelo.prototype.heartbeatTimeoutCb = function() {
  var gap = this.nextHeartbeatTimeout - Date.now();
  if (gap > this.gapThreshold) {
    this.heartbeatTimeoutId = setTimeout(this.heartbeatTimeoutCb.bind(this),
        gap);
  } else {
    this.emit('heartbeat timeout');
    this.disconnect();
  }
};

Pomelo.prototype.handshake = function(data) {
  var parseData = encrypt.parse(Protocol.strdecode(data));
  data = JSON.parse(parseData);
  if (data.code === RES_OLD_CLIENT) {
    this.emit('error', 'client version not fullfill');
    return;
  }

  if (data.code !== RES_OK) {
    this.emit('error', 'handshake fail');
    return;
  }
  this.handshakeInit(data);

  var obj = Package.encode(Package.TYPE_HANDSHAKE_ACK);
  this.send(obj);
  if (this.initCallback) {
    this.initCallback(null, this.socket);
    this.initCallback = null;
  }
};

Pomelo.prototype.onData = function(data) {
  //probuff decode
  var msg = Message.decode(data);
  if (msg.id > 0) {
    msg.route = this.routeMap[msg.id];
    delete this.routeMap[msg.id];
    if (!msg.route) {
      return;
    }
  }
  msg.body = this.deCompose(msg);
  this.processMessage(msg);
};

Pomelo.prototype.onKick = function(data) {
  this.emit('onKick', data);
};

Pomelo.prototype.processPackage = function(msg) {
  this.handlers[msg.type](msg.body);
};

Pomelo.prototype.processMessage = function(msg) {
  const decryptMsg = function(msg) {
    let route = msg.route;
    let data = msg.body;
    if (USE_ENCRYPT_PUSH && !!PUSH_ENCRYPT_INFO[route]) {
      let fields = PUSH_ENCRYPT_INFO[route];
      let length = fields.length;
      for (let i = 0; i < length; i++) {
        if (fields[i].indexOf('.') > -1) {
          let names = fields[i].split('.');
          let parentName = names[0];
          if (!!data[parentName]) {
            let arrayLength = data[parentName].length;
            for (let j = 0; j < arrayLength; j++) {
              let childName = names[1];
              let encryptData = data[parentName][j][childName];
              data[parentName][j][childName] = encrypt.parse(encryptData);
            }
          }
        } else {
          let encryptData = data[fields[i]];
          data[fields[i]] = encrypt.parse(encryptData);
        }
      }
    }
  };

  if (!msg || !msg.id) {
    // server push message
    decryptMsg(msg);
    this.emit(msg.route, msg.body);
    return;
  }
  //if have a id then find the callback function with the request
  var cb = this.callbacks[msg.id];
  delete this.callbacks[msg.id];
  if (typeof cb !== 'function') {
    return;
  }

  var parseMsgObj;
  if (USE_ENCRYPT_RESPONSE) {
    parseMsgObj = JSON.parse(encrypt.parse(msg.body.msg));
  } else {
    parseMsgObj = msg.body;
  }

  cb(null, parseMsgObj);
};

Pomelo.prototype.processMessageBatch = function(msgs) {
  for (var i = 0, l = msgs.length; i < l; i++) {
    this.processMessage(msgs[i]);
  }
};

Pomelo.prototype.deCompose = function(msg) {
  var protos = !!this.data.protos ? this.data.protos.server : {};
  var abbrs = this.data.abbrs;
  var route = msg.route;

  try {
    //Decompose route from dict
    if (msg.compressRoute) {
      if (!abbrs[route]) {
        return {};
      }

      route = msg.route = abbrs[route];
    }
    if (!!protos[route]) {
      return protobuf.decode(route, msg.body);
    } else {
      return JSON.parse(Protocol.strdecode(msg.body));
    }
  } catch (ex) {
  }

  return msg;
};

Pomelo.prototype.handshakeInit = function(data) {

  if (data.sys && data.sys.heartbeat) {
    this.heartbeatInterval = data.sys.heartbeat * 1000; // heartbeat interval
    this.heartbeatTimeout = this.heartbeatInterval * 2; // max heartbeat timeout
  } else {
    this.heartbeatInterval = 0;
    this.heartbeatTimeout = 0;
  }

  this.initData(data);

  if (typeof handshakeCallback === 'function') {
    this.handshakeCallback(data.user);
  }
};

//Initilize data used in pomelo client
Pomelo.prototype.initData = function(data) {
  if (!data || !data.sys) {
    return;
  }
  this.data = this.data || {};
  var dict = data.sys.dict;
  var protos = data.sys.protos;

  //Init compress dict
  if (!!dict) {
    this.data.dict = dict;
    this.data.abbrs = {};

    for (var route in dict) {
      this.data.abbrs[dict[route]] = route;
    }
  }

  //Init protobuf protos
  if (!!protos) {
    this.data.protos = {
      server: protos.server || {},
      client: protos.client || {},
    };
    if (!!protobuf) {
      protobuf.init({
        encoderProtos: protos.client,
        decoderProtos: protos.server,
      });
    }
  }
};

module.exports = Pomelo;
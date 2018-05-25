/**
 * Created by ggg on 2017/5/25.
 */
let pomeloClient = require('./pomelo-nodejsclient');

let newPomeloClient = function() {
  this.pc = new pomeloClient();
};

module.exports = newPomeloClient;

newPomeloClient.prototype.connectPromise = function(host, port) {
  let self = this;
  let params = {
    host: host,
    port: port,
  };

  return new Promise(function(resolve, reject) {
    self.pc.init(params, function(error) {
      if (!error) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
};

newPomeloClient.prototype.requestPromise = function(router, msg) {
  let self = this;
  return new Promise(function(resolve, reject) {
    self.pc.request(router, msg, function(err, data) {
      if (!!err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

newPomeloClient.prototype.disconnect = function() {
  this.pc.disconnect();
};

newPomeloClient.prototype.listenPush = function(route, func) {
  this.pc.on(route, func);
};
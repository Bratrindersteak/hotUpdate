/**
 * Created by lwcbest on 4/10/2017.
 */

const log4js = require('../pomelo-nodejsclient/node_modules/log4js');
let config = {
  appenders:
      {
        console: {
          type: 'console',
          category: 'console',
        }, cheese:
          {
            type: 'dateFile',
            filename: 'cheese-',
            alwaysIncludePattern: true,
            pattern: 'yyyyMMdd.log',
            category: 'cheese',
          },
      },
  categories: {default: {appenders: ['console', 'cheese'], level: 'trace'}},
  replaceConsole: true,
};

log4js.configure(config);

module.exports = function() {
  return {
    commonLogger: log4js.getLogger('cheese'),
  };
};

//trace,debug,info,warn,error,fatal
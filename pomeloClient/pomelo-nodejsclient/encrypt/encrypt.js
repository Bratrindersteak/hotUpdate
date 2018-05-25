var crypto = require('crypto');
var GUESS_KEY = require('./encryptConfig.json').GUESS_KEY;

/**
 * Create aes-128-ecb by text.
 *
 * @param  {String} text
 * @return {String} aes-128-ecb string
 */
module.exports.create = function (text) {
  var cipher = crypto.createCipher('aes-128-ecb', GUESS_KEY);
  var enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  return enc;
};

/**
 * Parse aes-128-ecb to validate it and get the text
 *
 * @param  {String} aesText string
 * @return {Object} text from aesText. null for illegal token.
 */
module.exports.parse = function (aesText) {
  var decipher = crypto.createDecipher('aes-128-ecb', GUESS_KEY);
  var dec;
  try {
    dec = decipher.update(aesText, 'hex', 'utf8');
    dec += decipher.final('utf8');
  } catch (err) {
    console.error('[aesText] fail to decrypt aesText. %j', aesText);
    return null;
  }
  return dec;
};

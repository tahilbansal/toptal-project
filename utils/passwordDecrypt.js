const CryptoJS = require("crypto-js");

function passwordEncrypt(plainText, passphrase = process.env.SECRET || '') {
  return CryptoJS.AES.encrypt(plainText, passphrase).toString();
}

function passwordDecrypt(cipherText, passphrase = process.env.SECRET || '') {
  const bytes = CryptoJS.AES.decrypt(cipherText, passphrase);
  return bytes.toString(CryptoJS.enc.Utf8);
}

if (process.env.NODE_ENV !== 'test') {
  const DEMO_VALUE = 'hello123';
  const DEMO_SECRET = 'my-secret';
  const cipher = passwordEncrypt(DEMO_VALUE, DEMO_SECRET);
  console.log('Encrypted:', cipher);
  console.log('Decrypted:', passwordDecrypt(cipher, DEMO_SECRET));
}

module.exports = passwordDecrypt;
module.exports.passwordDecrypt = passwordDecrypt;
module.exports.passwordEncrypt = passwordEncrypt;

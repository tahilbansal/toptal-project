const CryptoJS = require("crypto-js");

const passphrase = process.env.SECRET;

const passwordEncryptor = (plainText, pass) => {
  return CryptoJS.AES.encrypt(plainText, pass).toString();
};

// - Encrypt a new string
const newPlain = "tahil123";
const newCipher = passwordEncryptor(newPlain, passphrase);
console.log("New cipher:", newCipher);

// - Verify roundtrip decryption
const verify = CryptoJS.AES.decrypt(newCipher, passphrase).toString(CryptoJS.enc.Utf8);
console.log("Roundtrip decrypted:", JSON.stringify(verify));

const User = require("../models/User");
const CryptoJS = require("crypto-js");

async function seedBuiltInAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping admin seed");
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) return;

  if (!process.env.SECRET) {
    console.warn("SECRET not set; skipping admin seed");
    return;
  }

  const enc = CryptoJS.AES.encrypt(password, process.env.SECRET).toString();
  await User.create({
    username: "Administrator",
    email,
    password: enc,
    userType: "Admin",
    phoneVerification: true,
    verification: true,
    blocked: false
  });
  console.log(`Built-in admin created: ${email}`);
}

module.exports = { seedBuiltInAdmin };
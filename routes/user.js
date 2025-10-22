const router = require("express").Router();
const userController = require("../controllers/userController");
const {verifyTokenAndAuthorization, verifyAdmin}= require("../middlewares/verifyToken")

// UPADATE USER
router.put("/",verifyTokenAndAuthorization, userController.updateUser);

//VERIFY ACCOUNT
router.get("/verify/:otp",verifyTokenAndAuthorization, userController.verifyAccount);

// VERIFY PHONE
router.get("/verify_phone/:phone",verifyTokenAndAuthorization, userController.verifyPhone);

// DELETE USER
router.delete("/" , verifyTokenAndAuthorization, userController.deleteUser);

// GET USER
router.get("/",verifyTokenAndAuthorization, userController.getUser);

// GET ALL USERS
router.put("/updateToken/:token",verifyTokenAndAuthorization, userController.updateFcm);

module.exports = router
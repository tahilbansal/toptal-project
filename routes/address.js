const router = require("express").Router();
const addressController = require("../controllers/addressController");
const {verifyTokenAndAuthorization, verifyAdmin}= require("../middlewares/verifyToken")

// UPADATE USER
router.post("/",verifyTokenAndAuthorization, addressController.createAddress);

// DELETE USER
router.delete("/:id",verifyTokenAndAuthorization, addressController.deleteAddress);

// GET DEFAULT ADDRESS
router.get("/default",verifyTokenAndAuthorization, addressController.getDefaultAddress);

// GET ALL ADDRESSES
router.get("/all",verifyTokenAndAuthorization, addressController.getUserAddresses);

// UPDATE ADDRESS
router.put("/:id",verifyTokenAndAuthorization, addressController.updateAddress);

// SET DEFAULT ADDRESS
router.patch("/default/:address",verifyTokenAndAuthorization, addressController.setDefaultAddress);

module.exports = router
const router = require("express").Router();
const cartController = require("../controllers/cartController");
const {verifyTokenAndAuthorization, verifyAdmin} = require("../middlewares/verifyToken")

// ADD PRODUCT TO CART
router.post("/", verifyTokenAndAuthorization, cartController.addProductToCart);

// INCREMENT PRODUCT QUANTITY IN CART
router.post("/decrement",verifyTokenAndAuthorization, cartController.decrementProductQuantity);

// REMOVE PRODUCT FROM CART
router.delete("/delete/:id",verifyTokenAndAuthorization, cartController.removeProductFromCart);

// FETCH USER CART
router.get("/",verifyTokenAndAuthorization, cartController.fetchUserCart);

// GET CART COUNT
router.get("/count",verifyTokenAndAuthorization, cartController.getCartCount);

// CLEAR USER CART
router.delete("/clear/:id",verifyTokenAndAuthorization, cartController.clearUserCart);

module.exports = router
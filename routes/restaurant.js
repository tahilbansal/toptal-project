const router = require("express").Router();
const restaurantController = require("../controllers/restaurantController");
const { verifyTokenAndAuthorization, verifyVendor } = require("../middlewares/verifyToken");

// CREATE RESTAURANT
router.post("/",verifyTokenAndAuthorization,  restaurantController.addRestaurant);

// GET RESTAURANT BY OWNER
router.get("/profile", verifyVendor, restaurantController.getRestaurantByOwner);

// Services availability
router.patch("/:id",verifyVendor, restaurantController.serviceAvailability);

// GET RESTAURANT BY Pin
router.get("/:code", verifyTokenAndAuthorization , restaurantController.getRandomRestaurants);

// GET RESTAURANT BY ID
router.get("/all/:code", verifyTokenAndAuthorization, restaurantController.getAllRandomRestaurants);

// GET ALL RESTAURANT
router.get("/byId/:id", verifyTokenAndAuthorization, restaurantController.getRestaurant);

// GET RESTAURANT STATISTICS
router.get("/statistics/:id", verifyTokenAndAuthorization, restaurantController.getStats);

// CREATE PAYOUT REQUEST
router.post("/payout",verifyVendor, restaurantController.createPayout);

module.exports = router
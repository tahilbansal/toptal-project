const router = require("express").Router();
const ratingController = require("../controllers/ratingController");
const {verifyTokenAndAuthorization}= require("../middlewares/verifyToken")

// ADD RATING
router.post("/",verifyTokenAndAuthorization, ratingController.addRating);

// CHECK IF USER RATED RESTAURANT
router.get("/",verifyTokenAndAuthorization, ratingController.checkIfUserRatedRestaurant);

module.exports = router;
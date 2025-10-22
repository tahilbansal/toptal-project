const router = require("express").Router();
const foodController = require("../controllers/foodController");
const {verifyTokenAndAuthorization, verifyVendor}= require("../middlewares/verifyToken")


router.get('/restaurant-foods/:id', foodController.getFoodList)

router.post("/", verifyVendor , foodController.addFood);

router.post("/tags/:id", foodController.addFoodTag);

router.post("/type/:id", foodController.addFoodType);

router.get("/:id", foodController.getFoodById);

router.get("/search/:food", foodController.searchFoods);

router.get("/categories/:category/:code", foodController.getFoodsByCategoryAndCode);

router.get("/:category/:code", foodController.getRandomFoodsByCategoryAndCode);

router.delete("/:id", verifyVendor,foodController.deleteFoodById);

router.patch("/:id", foodController.foodAvailability);

router.get("/recommendation/:code", foodController.getRandomFoodsByCode);

module.exports = router
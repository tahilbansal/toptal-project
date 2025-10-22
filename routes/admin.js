const router = require("express").Router();
const adminController = require("../controllers/adminController");
const {verifyTokenAndAuthorization, verifyAdmin}= require("../middlewares/verifyToken")

// USERS (already present)
router.get("/users", verifyAdmin, adminController.adminGetUsers);
router.get("/users/:id", verifyAdmin, adminController.adminGetUserById);
router.post("/users", verifyAdmin, adminController.adminCreateUser);
router.put("/users/:id", verifyAdmin, adminController.adminUpdateUser);
router.patch("/users/:id/blocked", verifyAdmin, adminController.adminSetBlocked);
router.delete("/users/:id", verifyAdmin, adminController.adminDeleteUser);

// RESTAURANTS
router.get("/restaurants", verifyAdmin, adminController.adminGetRestaurants);
router.get("/restaurants/:id", verifyAdmin, adminController.adminGetRestaurantById);
router.post("/restaurants", verifyAdmin, adminController.adminCreateRestaurant);
router.put("/restaurants/:id", verifyAdmin, adminController.adminUpdateRestaurant);
router.patch("/restaurants/:id/blocked", verifyAdmin, adminController.adminSetRestaurantBlocked);
router.delete("/restaurants/:id", verifyAdmin, adminController.adminDeleteRestaurant);

// FOODS
router.get("/foods", verifyAdmin, adminController.adminGetFoods);
router.get("/foods/:id", verifyAdmin, adminController.adminGetFoodById);
router.post("/foods", verifyAdmin, adminController.adminCreateFood);
router.put("/foods/:id", verifyAdmin, adminController.adminUpdateFood);
router.patch("/foods/:id/blocked", verifyAdmin, adminController.adminSetFoodBlocked);
router.delete("/foods/:id", verifyAdmin, adminController.adminDeleteFood);

// COUPONS
router.post("/coupons", verifyAdmin, adminController.adminCreateCoupon);

module.exports = router
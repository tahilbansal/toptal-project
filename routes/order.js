const router = require("express").Router();
const ordersController = require("../controllers/orderController");
const {verifyTokenAndAuthorization, verifyDriver, verifyVendor}= require("../middlewares/verifyToken")

// GET RESTAURANT ORDERS
router.get("/restaurant_orders/:id", ordersController.getRestaurantOrders)

// GET RESTAURANT ORDERS LIST
router.get("/orderslist/:id", ordersController.getRestaurantOrdersList)

// PLACE ORDER
router.post("/",verifyTokenAndAuthorization, ordersController.placeOrder)

// GET ORDER DETAILS
router.get("/:id", ordersController.getOrderDetails)

// DELETE ORDER
router.delete("/:id", ordersController.deleteOrder)

// GET USER ORDERS
router.get("/",verifyTokenAndAuthorization,  ordersController.getUserOrders)

// GET NEARBY ORDERS FOR DELIVERY
router.get("/delivery/:status",  ordersController.getNearbyOrders)

// RATE ORDER
router.post("/rate/:id", ordersController.rateOrder)

// UPDATE ORDER STATUS
router.post("/status/:id", verifyTokenAndAuthorization, ordersController.updateOrderStatus)

// UPDATE PAYMENT STATUS
router.post("/payment-status/:id", ordersController.updatePaymentStatus)

// GET PICKED ORDERS BY DRIVER
router.get("/picked/:status/:driver",verifyDriver, ordersController.getPickedOrders)

// ASSIGN DRIVER TO ORDER
router.put("/picked-orders/:id/:driver", verifyDriver, ordersController.addDriver)

// MARK AS DELIVERED
router.put("/delivered/:id", verifyDriver, ordersController.markAsDelivered)

// PROCESS ORDER (VENDOR)
router.put("/process/:id/:status", verifyVendor, ordersController.processOrder)

module.exports = router;
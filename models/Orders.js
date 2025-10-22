const mongoose = require('mongoose');

const couponRef = { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null };

const orderItemSchema = new mongoose.Schema({
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: "Food" },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    additives: { type: Array },
    instructions: {type: String, default: ''},
});

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderItems: [orderItemSchema],
    orderTotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    tipAmount: { type: Number, default: 0 },
    coupon: couponRef,    
    couponCode: { type: String, default: "" },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true, default: 0 },
    deliveryAddress: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address", 
        required: true 
    },
    restaurantAddress: {type: String, required: true},
    paymentMethod: { type: String },
    paymentStatus: { type: String, default: "Pending", enum: ["Pending", "Completed", "Failed"] },
    orderStatus: { type: String, default: "Placed", enum: ["Placed", "Processing", "In Route", "Ready","Cancelled", "Delivered"] },
    orderDate: { type: Date, default: Date.now },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant"},
    restaurantCoords: [Number],
    recipientCoords: [Number],
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    rating: { type: Number, min: 1, max: 5 },
    feedback: String,
    promoCode: String,
    discountAmount: Number,
    notes: String
}, {timestamps: true});

module.exports = mongoose.model('Order', orderSchema);
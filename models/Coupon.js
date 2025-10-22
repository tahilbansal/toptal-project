const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    percentOff: { type: Number, required: true, min: 0, max: 100 },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date },
    maxDiscount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
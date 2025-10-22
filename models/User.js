const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        username: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        fcm: { type: String, required: true, default: "none" },
        otp: { type: String, required: true, default: "none" },
        verification: {type: Boolean, default: false},
        password: { type: String, required: true },
        phone: { type: String, required: false, default:"01234567890"},
        phoneVerification: { type: Boolean, default: false},
        address: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Address", 
            required: false
        },
        userType: { type: String, required: true, enum: ['Admin', 'Driver', 'Restaurant Owner', 'Customer'] },
        blocked: { type: Boolean, default: false , required: false},
        profile: {
            type: String,
            default: "https://example.com/default-avatar.png"
        },

    }, { timestamps: true }
);
module.exports = mongoose.model("User", UserSchema)
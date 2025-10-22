const FeedBack = require("../models/FeedBack");
const User = require("../models/User");
const Food = require("../models/Food");
const admin = require('firebase-admin');
const CryptoJS = require("crypto-js"); 
const Restaurant = require("../models/Restaurant");
const Coupon = require("../models/Coupon");

const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

module.exports = {

  // ===== USERS (Admin can CRUD any role) =====
  adminCreateUser: async (req, res) => {
    try {
      const { username, email, password, userType = "Customer", phone, fcm, profile } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ status: false, message: "username, email, password are required" });
      }
      if (!emailRegex.test(email)) {
        return res.status(400).json({ status: false, message: "Invalid email format" });
      }
      const exists = await User.findOne({ email });
      if (exists) return res.status(409).json({ status: false, message: "Email already in use" });

      const encryptedPassword = CryptoJS.AES.encrypt(password, process.env.SECRET).toString();

      const user = await User.create({
        username,
        email,
        password: encryptedPassword,
        userType,
        phone: phone || "",
        fcm: fcm || "none",
        profile: profile || ""
      });

      const { password: _pw, __v, ...data } = user.toObject();
      return res.status(201).json({ status: true, data });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  // List users (optional filters: role, email, blocked)
  adminGetUsers: async (req, res) => {
    try {
      const { role, email, blocked, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (role) filter.userType = role;
      if (email) filter.email = email;
      if (typeof blocked !== "undefined") filter.blocked = blocked === "true";

      const users = await User.find(filter)
        .select("-password -__v")
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .sort({ createdAt: -1 });

      const count = await User.countDocuments(filter);
      return res.status(200).json({ status: true, data: users, pagination: { page: Number(page), limit: Number(limit), total: count } });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  // Get single user
  adminGetUserById: async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select("-password -__v");
      if (!user) return res.status(404).json({ status: false, message: "User not found" });
      return res.status(200).json({ status: true, data: user });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  // Update user (any field, re-encrypt password if provided)
  adminUpdateUser: async (req, res) => {
    try {
      const updates = { ...req.body };

      if (updates.email && !emailRegex.test(updates.email)) {
        return res.status(400).json({ status: false, message: "Invalid email format" });
      }
      if (updates.email) {
        const dup = await User.findOne({ email: updates.email, _id: { $ne: req.params.id } });
        if (dup) return res.status(409).json({ status: false, message: "Email already in use" });
      }
      if (updates.password) {
        updates.password = CryptoJS.AES.encrypt(updates.password, process.env.SECRET).toString();
      }

      const updated = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
      if (!updated) return res.status(404).json({ status: false, message: "User not found" });

      const { password, __v, ...data } = updated.toObject();
      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  // Block/Unblock
  adminSetBlocked: async (req, res) => {
    try {
      const { blocked } = req.body;
      if (typeof blocked !== "boolean") {
        return res.status(400).json({ status: false, message: "blocked must be boolean" });
      }

      // prevent deleting/blocking the built-in admin by email if set
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ status: false, message: "User not found" });
      if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
        return res.status(403).json({ status: false, message: "Cannot block built-in admin" });
      }

      user.blocked = blocked;
      await user.save();
      const { password, __v, ...data } = user.toObject();
      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  // Delete user (protect built-in admin)
  adminDeleteUser: async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ status: false, message: "User not found" });

      if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
        return res.status(403).json({ status: false, message: "Cannot delete built-in admin" });
      }

      await User.findByIdAndDelete(req.params.id);
      return res.status(200).json({ status: true, message: "User deleted" });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },


  // ===== RESTAURANTS =====
  adminCreateRestaurant: async (req, res) => {
    try {
      const { owner, title, time, imageUrl, code, logoUrl, coords } = req.body;
      if (!owner || !title || !time || !imageUrl || !code || !logoUrl || !coords?.latitude || !coords?.longitude || !coords?.address || !coords?.title) {
        return res.status(400).json({ status: false, message: "Missing required fields" });
      }
      const ownerUser = await User.findById(owner);
      if (!ownerUser) return res.status(404).json({ status: false, message: "Owner user not found" });
      const existing = await Restaurant.findOne({ owner });
      if (existing) return res.status(409).json({ status: false, message: "Owner already has a restaurant", data: existing });

      const restaurant = await Restaurant.create({ owner, title, time, imageUrl, code, logoUrl, coords, blocked: false });
      await User.findByIdAndUpdate(owner, { userType: "Restaurant Owner" }, { new: true });
      return res.status(201).json({ status: true, data: restaurant });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  adminGetRestaurants: async (req, res) => {
    try {
      const { code, owner, blocked, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (code) filter.code = code;
      if (owner) filter.owner = owner;
      if (typeof blocked !== "undefined") filter.blocked = blocked === "true";
      const [items, count] = await Promise.all([
        Restaurant.find(filter).skip((Number(page)-1)*Number(limit)).limit(Number(limit)).sort({ createdAt: -1 }),
        Restaurant.countDocuments(filter)
      ]);
      return res.status(200).json({ status: true, data: items, pagination: { page: Number(page), limit: Number(limit), total: count } });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  adminGetRestaurantById: async (req, res) => {
    try {
      const r = await Restaurant.findById(req.params.id);
      if (!r) return res.status(404).json({ status: false, message: "Restaurant not found" });
      return res.status(200).json({ status: true, data: r });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  adminUpdateRestaurant: async (req, res) => {
    try {
      const updates = { ...req.body };
      if (updates.owner) {
        const ownerUser = await User.findById(updates.owner);
        if (!ownerUser) return res.status(400).json({ status: false, message: "New owner not found" });
      }
      const updated = await Restaurant.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
      if (!updated) return res.status(404).json({ status: false, message: "Restaurant not found" });
      return res.status(200).json({ status: true, data: updated });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  adminSetRestaurantBlocked: async (req, res) => {
    try {
      const { blocked } = req.body;
      if (typeof blocked !== "boolean") return res.status(400).json({ status: false, message: "blocked must be boolean" });
      const r = await Restaurant.findById(req.params.id);
      if (!r) return res.status(404).json({ status: false, message: "Restaurant not found" });
      r.blocked = blocked;
      await r.save();
      return res.status(200).json({ status: true, data: r });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  adminDeleteRestaurant: async (req, res) => {
    try {
      const r = await Restaurant.findById(req.params.id);
      if (!r) return res.status(404).json({ status: false, message: "Restaurant not found" });
      await Restaurant.findByIdAndDelete(req.params.id);
      return res.status(200).json({ status: true, message: "Restaurant deleted" });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  // ===== FOODS (MEALS) =====
  adminCreateFood: async (req, res) => {
    try {
      const { title, foodTags, category, foodType, code, isAvailable = true, restaurant, description, time, price, additives, imageUrl } = req.body;
      if (!title || !foodTags || !category || !foodType || !code || !description || time == null || price == null || !additives || !imageUrl || !restaurant) {
        return res.status(400).json({ status: false, message: "Missing required fields" });
      }
      const r = await Restaurant.findById(restaurant);
      if (!r) return res.status(404).json({ status: false, message: "Restaurant not found" });
      const food = await Food.create({ title, foodTags, category, foodType, code, isAvailable, restaurant, description, time, price, additives, imageUrl, blocked: false });
      return res.status(201).json({ status: true, data: food });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  adminGetFoods: async (req, res) => {
    try {
      const { restaurant, category, code, blocked, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (restaurant) filter.restaurant = restaurant;
      if (category) filter.category = category;
      if (code) filter.code = code;
      if (typeof blocked !== "undefined") filter.blocked = blocked === "true";
      const [items, count] = await Promise.all([
        Food.find(filter).skip((Number(page)-1)*Number(limit)).limit(Number(limit)).sort({ createdAt: -1 }),
        Food.countDocuments(filter)
      ]);
      return res.status(200).json({ status: true, data: items, pagination: { page: Number(page), limit: Number(limit), total: count } });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  adminGetFoodById: async (req, res) => {
    try {
      const f = await Food.findById(req.params.id);
      if (!f) return res.status(404).json({ status: false, message: "Food not found" });
      return res.status(200).json({ status: true, data: f });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  adminUpdateFood: async (req, res) => {
    try {
      const updated = await Food.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
      if (!updated) return res.status(404).json({ status: false, message: "Food not found" });
      return res.status(200).json({ status: true, data: updated });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  adminSetFoodBlocked: async (req, res) => {
    try {
      const { blocked } = req.body;
      if (typeof blocked !== "boolean") return res.status(400).json({ status: false, message: "blocked must be boolean" });
      const f = await Food.findById(req.params.id);
      if (!f) return res.status(404).json({ status: false, message: "Food not found" });
      f.blocked = blocked;
      await f.save();
      return res.status(200).json({ status: true, data: f });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  adminDeleteFood: async (req, res) => {
    try {
      const f = await Food.findById(req.params.id);
      if (!f) return res.status(404).json({ status: false, message: "Food not found" });
      await Food.findByIdAndDelete(req.params.id);
      return res.status(200).json({ status: true, message: "Food deleted" });
    } catch (error) { return res.status(500).json({ status: false, message: error.message }); }
  },

  // ===== COUPONS =====
  adminCreateCoupon: async (req, res) => {
    try {
      let { code, percentOff, active = true, expiresAt, maxDiscount = 0 } = req.body;

      if (!code || percentOff === undefined) {
        return res.status(400).json({ status: false, message: "code and percentOff are required" });
      }

      code = String(code).toUpperCase().trim();
      percentOff = Number(percentOff);
      maxDiscount = Number(maxDiscount);

      if (Number.isNaN(percentOff) || percentOff < 0 || percentOff > 100) {
        return res.status(400).json({ status: false, message: "percentOff must be between 0 and 100" });
      }

      let exp = undefined;
      if (expiresAt) {
        exp = new Date(expiresAt);
        if (isNaN(exp.getTime())) {
          return res.status(400).json({ status: false, message: "expiresAt must be a valid date" });
        }
      }

      const coupon = await Coupon.create({
        code,
        percentOff,
        active: Boolean(active),
        expiresAt: exp,
        maxDiscount: Number.isNaN(maxDiscount) ? 0 : maxDiscount
      });

      return res.status(201).json({ status: true, data: coupon });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ status: false, message: "Coupon code already exists" });
      }
      return res.status(500).json({ status: false, message: error.message });
    }
  },

};
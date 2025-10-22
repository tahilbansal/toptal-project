const jwt = require("jsonwebtoken");
const User = require("../models/User");


const verifyToken = (req, res, next)=> {
    const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: false, message: "You are not authenticated" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SEC, async (err, payload) => {
    if (err) {
      return res.status(403).json({ status: false, message: "Token invalid or expired" });
    }

    try {
      const user = await User.findById(payload.id).select("_id userType blocked");
      if (!user) return res.status(401).json({ status: false, message: "User not found" });
      if (user.blocked) return res.status(403).json({ status: false, message: "User is blocked" });

      req.user = { id: user._id.toString(), userType: user.userType };
      next();
    } catch (e) {
      return res.status(500).json({ status: false, message: "Auth check failed" });
    }
  });
}

const verifyTokenAndAuthorization = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.userType === 'Customer' || req.user.userType === 'Driver' || req.user.userType === 'Restaurant Owner'|| req.user.userType === 'Admin') {
            next();
        } else {
            res.status(403).json("You are restricted from perfoming this operation");
        }
    });
};

const verifyVendor = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.userType === "Restaurant Owner" || req.user.userType === "Admin") {
            next();
        } else {
            res.status(403).json("You have limited access");
        }
    });
};


const verifyDriver = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.userType === "Driver" || req.user.userType === "Admin") {
            next();
        } else {
            res.status(403).json("You are restricted from perfoming this operation");
        }
    });
};


const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.userType === "Admin") {
            next();
        } else {
            res.status(403).json("You are restricted from perfoming this operation");
        }
    });
};

module.exports = { verifyToken, verifyTokenAndAuthorization, verifyVendor, verifyDriver, verifyAdmin };

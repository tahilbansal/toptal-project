const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const dotenv = require('dotenv');
const compression = require('compression');
const { fireBaseConnection } = require('./utils/fbConnect');
const authRoute = require("./routes/auth");
const userRoute = require("./routes/user");
const restRoute = require("./routes/restaurant");
const catRoute = require("./routes/category");
const foodRoute = require("./routes/food");
const cartRoute = require("./routes/cart");
const addressRoute = require("./routes/address");
const driverRoute = require("./routes/driver");
const messagingRoute = require("./routes/messaging");
const orderRoute = require("./routes/order");
const ratingRoute = require("./routes/rating");
const uploadRoute =require("./routes/uploads");
const adminRoute = require("./routes/admin");

dotenv.config()

fireBaseConnection();

const mongoose = require('mongoose');
const { seedBuiltInAdmin } = require("./utils/seedAdmin");
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("connected to the db")).catch((err) => { console.log(err) });

// Run once when Mongo connects for admin seed 
mongoose.connection.once("open", () => {
  seedBuiltInAdmin().catch(err => console.error("Admin seed failed:", err));
});
    
app.use(compression({
    level: 6,
    threshold: 0
}))

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/", authRoute);
app.use("/api/admin", adminRoute);
app.use("/api/users", userRoute);
app.use("/api/restaurant", restRoute);
app.use("/api/category", catRoute);
app.use("/api/foods", foodRoute);
app.use("/api/cart", cartRoute);
app.use("/api/address", addressRoute);
app.use("/api/driver", driverRoute);
app.use("/api/orders", orderRoute);
app.use("/api/rating", ratingRoute);
app.use("/api/messaging", messagingRoute);
app.use("/api/uploads", uploadRoute);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});



// const ip =  "192.168.137.228";

// const port = process.env.PORT || 3000; 

// app.listen(port, ip, () => {
//   console.log(`Product server listening on ${ip}:${port}`);
// });
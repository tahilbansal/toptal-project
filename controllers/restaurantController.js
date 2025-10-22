const Orders = require("../models/Orders");
const Payout = require("../models/Payout");
const Restaurant =require("../models/Restaurant")
const User =require("../models/User");
const payoutRequestEmail = require("../utils/payoutRequestEmail");


module.exports ={
    addRestaurant: async (req, res) => {
        const owner = req.user.id;
        const { title, time, imageUrl, code, logoUrl, coords } = req.body;
    
        // Check if required fields are not empty
        if (!title || !time || !imageUrl ||  !code || !logoUrl || !coords || !coords.latitude || !coords.longitude || !coords.address || !coords.title) {
            return res.status(400).json({ status: false, message: 'Missing required fields' });
        }
    
        // Check if the restaurant code already exists
        const existingRestaurant = await Restaurant.findOne({ owner: owner });
        if (existingRestaurant) {
            return res.status(400).json({ status: false, message: 'Restaurant with this code already exists', data: existingRestaurant });
        }
    
        const newRestaurant = new Restaurant(req.body);
    
        try {
            await newRestaurant.save();
            await User.findByIdAndUpdate(
                owner,
                { userType: "Restaurant Owner" },
                { new: true, runValidators: true });
            

            res.status(201).json({ status: true, message: 'Restaurant successfully created' });
        } catch (error) {
            res.status(500).json({status: false, message: error.message });
        }
    },


    getRestaurantByOwner: async (req, res) => {
        const id = req.user.id;

        try {
            const restaurant = await Restaurant.findOne({owner: id}) // populate the restaurant field if needed


            if (!restaurant) {
                return res.status(404).json({ status: false, message: 'restaurant item not found' });
            }

            res.status(200).json(restaurant);
        } catch (error) {
            res.status(500).json({status: false, message: error.message });
        }
    },
    

     getRandomRestaurants: async (req, res) => {
        try {
            let randomRestaurants = [];
    
            // Check if code is provided in the params
            if (req.params.code) {
                randomRestaurants = await Restaurant.aggregate([
                    { $match: { code: req.params.code, serviceAvailability: true } },
                    { $sample: { size: 5 } },
                    { $project: {  __v: 0 } }
                ]);
            }
            
            // If no code provided in params or no restaurants match the provided code
            if (!randomRestaurants.length) {
                randomRestaurants = await Restaurant.aggregate([
                    { $sample: { size: 5 } },
                    { $project: {  __v: 0 } }
                ]);
            }
    
            // Respond with the results
            if (randomRestaurants.length) {
                res.status(200).json(randomRestaurants);
            } else {
                res.status(404).json({status: false, message: 'No restaurants found' });
            }
        } catch (error) {
            res.status(500).json({status: false, message: error.message });
        }
    },

    

    getAllRandomRestaurants: async (req, res) => {
        try {
            let randomRestaurants = [];
    
            // Check if code is provided in the params
            if (req.params.code) {
                randomRestaurants = await Restaurant.aggregate([
                    { $match: { code: req.params.code, serviceAvailability: true } },
                    { $project: {  __v: 0 } }
                ]);
            }
            
            // If no code provided in params or no restaurants match the provided code
            if (!randomRestaurants.length) {
                randomRestaurants = await Restaurant.aggregate([
                    { $project: {  __v: 0 } }
                ]);
            }
    
            // Respond with the results
            if (randomRestaurants.length) {
                res.status(200).json(randomRestaurants);
            } else {
                res.status(404).json({status: false, message: 'No restaurants found' });
            }
        } catch (error) {
            res.status(500).json({status: false, message: error.message });
        }
    },

     serviceAvailability: async (req, res) => {
        const restaurantId = req.params.id; 
    
        try {
            // Find the restaurant by its ID
            const restaurant = await Restaurant.findById(restaurantId);
    
            if (!restaurant) {
                return res.status(404).json({ message: 'Restaurant not found' });
            }
    
            // Toggle the isAvailable field
            restaurant.isAvailable = !restaurant.isAvailable;
    
            // Save the changes
            await restaurant.save();
    
            res.status(200).json({ message: 'Availability toggled successfully', isAvailable: restaurant.isAvailable });
        } catch (error) {
            res.status(500).json({status: false, message: error.message});
        }
    },

    deleteRestaurant: async (req, res) => {
        const id  = req.params;
    
        if (!id) {
            return res.status(400).json({ status: false, message: 'Restaurant ID is required for deletion.' });
        }
    
        try {
            await Restaurant.findByIdAndRemove(id);
    
            res.status(200).json({ status: true, message: 'Restaurant successfully deleted' });
        } catch (error) {
            console.error("Error deleting Restaurant:", error);
            res.status(500).json({ status: false, message: 'An error occurred while deleting the restaurant.' });
        }
    },
    
    getRestaurant: async (req, res) => {
        const id = req.params.id;

        try {
            const restaurant = await Restaurant.findById(id) // populate the restaurant field if needed

            if (!restaurant) {
                return res.status(404).json({ status: false, message: 'restaurant item not found' });
            }

            

            res.status(200).json(restaurant);
        } catch (error) {
            res.status(500).json(error);
        }
    },

    getStats: async (req, res) => {
        const id = req.params.id;
        try {
            const data = await Restaurant.findById(id, {coords: 0});
            
            const ordersTotal = await Orders.countDocuments({ restaurantId: id, orderStatus: "Delivered" });
            const deliveryRevenue = await Orders.countDocuments({ restaurantId: id, orderStatus: "Delivered" });
            const cancelledOrders = await Orders.countDocuments({ restaurantId: id, orderStatus: "Cancelled" });
            
           

            const latestPayout = await Payout.find({restaurant: id}).sort({ createdAt: -1 });
            const processingOrders = await Orders.countDocuments({
                restaurantId: id,
                orderStatus: {
                  $in: ["Placed", "Preparing", "Manual", "Ready", "Out_for_Delivery"],
                },
              });


            const revenueTotal = parseFloat(data.earnings.toFixed(2))
            const restaurantToken = await User.findById(data.owner, { fcm: 1 });
           


            res.status(200).json(
                {
                    data,
                    latestPayout,
                    ordersTotal,
                    cancelledOrders,
                    revenueTotal,
                    processingOrders,
                    restaurantToken
                });


        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },

    createPayout: async (req, res) => {
       
        try {
            const restaurant = await Restaurant.findById(req.body.restaurant);
            const user = await User.findById(restaurant.owner, { email: 1, username: 1 });

            if (!user) {
                return res.status(404).json({ status: false, message: "User not found" });
            }

            const cashout = new Payout({
                amount: req.body.amount,
                restaurant: req.body.restaurant,
                accountNumber: req.body.accountNumber,
                accountName: req.body.accountName,
                accountBank: req.body.accountBank,
                paymentMethod: req.body.paymentMethod,
            });
            await cashout.save();
           
            payoutRequestEmail(user.email, user.username,req.body.amount)
            res.status(201).json({ status: true, message: "Cashout request sent successfully" });
        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },

    getRestarantFinance: async (req, res) => {
        const id = req.params.id;

        try {
            const restaurant = await Restaurant.findById(id) // populate the restaurant field if needed

            if (!restaurant) {
                return res.status(404).json({ status: false, message: 'restaurant item not found' });
            }

            res.status(200).json(restaurant);
        } catch (error) {
            res.status(500).json(error);
        } 
    },


    
}
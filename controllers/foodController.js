const Food = require("../models/Food")


module.exports = {
    addFood: async (req, res) => {
        const { title, foodTags, category, foodType, code, isAvailable, restaurant, description,time, price, additives, imageUrl } = req.body;

        // Simple validation
        if (!title || !foodTags || !category || !foodType || !code || !description || !price || !additives || !time || !imageUrl || !restaurant || !isAvailable) {
            return res.status(400).json({ status: false, message: 'Missing required fields' });
        }
        const newFood = new Food({
            title: req.body.title,
            foodTags: req.body.foodTags,
            category: req.body.category,
            foodType: req.body.foodType,
            code: req.body.code,
            isAvailable: req.body.isAvailable,
            restaurant: req.body.restaurant,
            description: req.body.description,
            time: req.body.time,
            price: req.body.price,
            additives: req.body.additives,
            imageUrl: req.body.imageUrl
        });
    
        try {
            await newFood.save();
            res.status(201).json({ status: true, message: 'Food item successfully created', data: newFood });
        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },

    getFoodById: async (req, res) => {
        const foodId = req.params.id;

        try {
            const food = await Food.findById(foodId)
                .populate({
                    path: 'Food',
                    select: 'coords'
                })

            if (!food) {
                return res.status(404).json({ status: false, message: 'Food item not found' });
            }

            res.status(200).json(food);
        } catch (error) {
            res.status(500).json(error);
        }
    },

    getFoodList: async (req, res) => {
        const restaurant = req.params.id;
      
        try {
          const foods = await Food.find({ restaurant: restaurant }).sort({ createdAt: -1 }); // Sort by date in descending order (newest first)
      
          res.status(200).json(foods);
        } catch (error) {
          res.status(500).json({ status: false, message: error.message });
        }
      },


    deleteFoodById: async (req, res) => {
        const foodId = req.params.id;

        try {
            const food = await Food.findByIdAndDelete(foodId);

            if (!food) {
                return res.status(404).json({ status: false, message: 'Food item not found' });
            }

            res.status(200).json({ status: true, message: 'Food item successfully deleted' });
        } catch (error) {
            res.status(500).json(error);
        }
    },

    foodAvailability: async (req, res) => {
        const foodId = req.params.id;

        try {
            // Find the restaurant by its ID
            const food = await Food.findById(foodId);

            if (!restaurant) {
                return res.status(404).json({ message: 'Food not found' });
            }

            // Toggle the isAvailable field
            food.isAvailable = !food.isAvailable;

            // Save the changes
            await food.save();

            res.status(200).json({ message: 'Availability toggled successfully' });
        } catch (error) {
            res.status(500).json(error);
        }
    },

    updateFoodById: async (req, res) => {
        const foodId = req.params.id;

        try {
            const updatedFood = await Food.findByIdAndUpdate(foodId, req.body, { new: true, runValidators: true });

            if (!updatedFood) {
                return res.status(404).json({ status: false, message: 'Food item not found' });
            }

            res.status(200).json({ status: true, message: 'Food item successfully updated' });
        } catch (error) {
            res.status(500).json(error);
        }
    },

    addFoodTag: async (req, res) => {
        const foodId = req.params.id;
        const { tag } = req.body;  // Assuming the tag to be added is sent in the request body

        if (!tag) {
            return res.status(400).json({ status: false, message: 'Tag is required' });
        }

        try {
            const food = await Food.findById(foodId);

            if (!food) {
                return res.status(404).json({ status: false, message: 'Food item not found' });
            }

            // Check if tag already exists
            if (food.foodTags.includes(tag)) {
                return res.status(400).json({ status: false, message: 'Tag already exists' });
            }

            food.foodTags.push(tag);
            await food.save();

            res.status(200).json({ status: true, message: 'Tag successfully added', data: food });
        } catch (error) {
            res.status(500).json(error);
        }
    },


    getRandomFoodsByCode: async (req, res) => {
        try {
            let randomFoodList = [];
    
            // Check if code is provided in the params
            if (req.params.code) {
                randomFoodList = await Food.aggregate([
                    { $match: { code: req.params.code } },
                    { $sample: { size: 3 } },
                    { $project: {  __v: 0 } }
                ]);
            }
            
            // If no code provided in params or no Foods match the provided code
            if (!randomFoodList.length) {
                randomFoodList = await Food.aggregate([
                    { $sample: { size: 5 } },
                    { $project: {  __v: 0 } }
                ]);
            }
    
            // Respond with the results
            if (randomFoodList.length) {
                res.status(200).json(randomFoodList);
            } else {
                res.status(404).json({status: false, message: 'No Foods found' });
            }
        } catch (error) {
            res.status(500).json(error);
        }
    },


    addFoodType: async (req, res) => {
        const foodId = req.params.id;
        const { foodType } = req.body.foodType;  // Assuming the tag to be added is sent in the request body


        try {
            const food = await Food.findById(foodId);

            if (!food) {
                return res.status(404).json({ status: false, message: 'Food item not found' });
            }

            // Check if tag already exists
            if (food.foodType.includes(foodType)) {
                return res.status(400).json({ status: false, message: 'Type already exists' });
            }

            food.foodType.push(foodType);
            await food.save();

            res.status(200).json({ status: true, message: 'Type successfully added' });
        } catch (error) {
            res.status(500).json(error);
        }
    },

    getRandomFoodsByCategoryAndCode: async (req, res) => {
        const { category, code } = req.params;  // Assuming category, code, and value are sent as parameters

        try {
            let foods = await Food.aggregate([
                { $match: { category: category } },
                { $sample: { size: 10 } }
            ]);

            if (!foods || foods.length === 0) {
                foods = await Food.aggregate([
                    { $match: { code: code } },
                    { $sample: { size: 10 } }
                ]);
            } else {
                foods = await Food.aggregate([
                    { $sample: { size: 10 } }
                ]);
            }

            res.status(200).json(foods);
        } catch (error) {
            res.status(500).json({ error: error.message, status: false });
        }
    },

    getFoodsByCategoryAndCode: async (req, res) => {
        const { category, code } = req.params;  // Assuming category, code, and value are sent as parameters
        try {
            const foods = await Food.aggregate([
                { $match: { category: category } },
            ]);

            if(foods.length === 0){
                return res.status(200).json([])
            }

            res.status(200).json(foods);
        } catch (error) {
            res.status(500).json({ error: error.message, status: false });
        }
    },

    searchFoods: async (req, res) => {
        const search = req.params.food
        try {
            const results = await Food.aggregate(
                [
                    {
                        $search: {
                            index: "foods",
                            text: {
                                query: search,
                                path: {
                                    wildcard: "*"
                                }
                            }
                        }
                    }
                ]
            )
            res.status(200).json(results);
        } catch (error) {
            res.status(500).json({ error: error.message, status: false });
        }
    },

}
const router = require("express").Router();
const categoryController = require("../controllers/categoryController");

// UPADATE category
router.put("/:id", categoryController.updateCategory);

// CREATE category
router.post("/", categoryController.createCategory);

// DELETE category
router.delete("/:id", categoryController.deleteCategory);

// PATCH category image
router.post("/image/:id", categoryController.patchCategoryImage);

// GET ALL categories
router.get("/", categoryController.getAllCategories);

// GET RANDOM categories
router.get("/random", categoryController.getRandomCategories);

module.exports = router
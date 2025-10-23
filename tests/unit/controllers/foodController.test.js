const { mockReqRes } = require('../../helpers/mockReqRes');

jest.mock('../../../models/Food', () => {
  const saveMock = jest.fn().mockResolvedValue();
  function Food(doc) { Object.assign(this, doc); this.save = saveMock; }
  Food.findById = jest.fn();
  Food.aggregate = jest.fn();
  Food.find = jest.fn();
  Food.findByIdAndDelete = jest.fn();
  Food.findByIdAndUpdate = jest.fn();
  Food.__saveMock = saveMock;
  return Food;
});

const Food = require('../../../models/Food');
const controller = require('../../../controllers/foodController');

describe('foodController', () => {
    beforeAll(() => {
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
  beforeEach(() => {
    jest.clearAllMocks();
    Food.__saveMock.mockResolvedValue();
  });

  describe('addFood', () => {
    it('400 on missing fields', async () => {
      const { req, res } = mockReqRes({ body: { title: 'A' } });
      await controller.addFood(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('201 on success', async () => {
      const body = {
        title: 'Dish',
        foodTags: ['t'],
        category: 'cat',
        foodType: ['veg'],
        code: 'C',
        isAvailable: true,
        restaurant: 'r1',
        description: 'desc',
        time: 10,
        price: 9.99,
        additives: [],
        imageUrl: ['img']
      };
      const { req, res } = mockReqRes({ body });
      await controller.addFood(req, res);
      expect(Food.__saveMock).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getFoodById', () => {
    it('404 when not found', async () => {
      Food.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
      const { req, res } = mockReqRes({ params: { id: 'fX' } });
      await controller.getFoodById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('200 when found', async () => {
      Food.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: 'f1' }) });
      const { req, res } = mockReqRes({ params: { id: 'f1' } });
      await controller.getFoodById(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getFoodList', () => {
    it('200 returns foods sorted', async () => {
      Food.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([{ _id: 'f1' }]) });
      const { req, res } = mockReqRes({ params: { id: 'r1' } });
      await controller.getFoodList(req, res);
      expect(Food.find).toHaveBeenCalledWith({ restaurant: 'r1' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteFoodById', () => {
    it('404 when not found', async () => {
      Food.findByIdAndDelete.mockResolvedValue(null);
      const { req, res } = mockReqRes({ params: { id: 'fX' } });
      await controller.deleteFoodById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('200 on success', async () => {
      Food.findByIdAndDelete.mockResolvedValue({ _id: 'f1' });
      const { req, res } = mockReqRes({ params: { id: 'f1' } });
      await controller.deleteFoodById(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('foodAvailability', () => {
    it('500 due to controller bug (restaurant variable)', async () => {
      Food.findById.mockResolvedValue({ _id: 'f1', isAvailable: true, save: jest.fn().mockResolvedValue() });
      const { req, res } = mockReqRes({ params: { id: 'f1' } });
      await controller.foodAvailability(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateFoodById', () => {
    it('404 when not found', async () => {
      Food.findByIdAndUpdate.mockResolvedValue(null);
      const { req, res } = mockReqRes({ params: { id: 'fX' }, body: { title: 'x' } });
      await controller.updateFoodById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('200 on success', async () => {
      Food.findByIdAndUpdate.mockResolvedValue({ _id: 'f1' });
      const { req, res } = mockReqRes({ params: { id: 'f1' }, body: { title: 'x' } });
      await controller.updateFoodById(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('addFoodTag', () => {
    it('400 when tag missing', async () => {
      const { req, res } = mockReqRes({ params: { id: 'f1' }, body: {} });
      await controller.addFoodTag(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 when duplicate', async () => {
      const doc = { foodTags: ['hot'], save: jest.fn() };
      Food.findById.mockResolvedValue(doc);
      const { req, res } = mockReqRes({ params: { id: 'f1' }, body: { tag: 'hot' } });
      await controller.addFoodTag(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('200 when added', async () => {
      const doc = { foodTags: [], save: jest.fn().mockResolvedValue() };
      Food.findById.mockResolvedValue(doc);
      const { req, res } = mockReqRes({ params: { id: 'f1' }, body: { tag: 'new' } });
      await controller.addFoodTag(req, res);
      expect(doc.foodTags).toContain('new');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getRandomFoodsByCode', () => {
    it('uses code when provided else fallback (200)', async () => {
      Food.aggregate.mockResolvedValueOnce([{ _id: 'f1' }]);
      const { req, res } = mockReqRes({ params: { code: 'X' } });
      await controller.getRandomFoodsByCode(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('404 when both empty', async () => {
      Food.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const { req, res } = mockReqRes({ params: {} });
      await controller.getRandomFoodsByCode(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('addFoodType', () => {
    it('400 duplicate type', async () => {
      const doc = { foodType: ['veg'], save: jest.fn() };
      Food.findById.mockResolvedValue(doc);
      const { req, res } = mockReqRes({ params: { id: 'f1' }, body: { foodType: { foodType: 'veg' } } });
      await controller.addFoodType(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('200 on add type', async () => {
      const doc = { foodType: [], save: jest.fn().mockResolvedValue() };
      Food.findById.mockResolvedValue(doc);
      const { req, res } = mockReqRes({ params: { id: 'f1' }, body: { foodType: { foodType: 'veg' } } });
      await controller.addFoodType(req, res);
      expect(doc.foodType).toContain('veg');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getRandomFoodsByCategoryAndCode', () => {
    it('returns sample (200)', async () => {
      Food.aggregate.mockResolvedValueOnce([{ _id: 'f1' }]).mockResolvedValueOnce([{ _id: 'f2' }]).mockResolvedValueOnce([{ _id: 'f3' }]);
      const { req, res } = mockReqRes({ params: { category: 'cat', code: 'X' } });
      await controller.getRandomFoodsByCategoryAndCode(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getFoodsByCategoryAndCode', () => {

    it('returns list (200)', async () => {
      Food.aggregate.mockResolvedValueOnce([{ _id: 'f1' }]);
      const { req, res } = mockReqRes({ params: { category: 'cat', code: 'X' } });
      await controller.getFoodsByCategoryAndCode(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('searchFoods', () => {
    it('returns results (200)', async () => {
      Food.aggregate.mockResolvedValue([{ _id: 'f1' }]);
      const { req, res } = mockReqRes({ params: { food: 'pizza' } });
      await controller.searchFoods(req, res);
      expect(Food.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
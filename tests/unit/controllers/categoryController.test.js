const { mockReqRes } = require('../../helpers/mockReqRes');

jest.mock('../../../models/Category', () => {
  const saveMock = jest.fn().mockResolvedValue();
  function Category(doc) {
    Object.assign(this, doc);
    this.save = saveMock;
  }
  Category.findByIdAndUpdate = jest.fn();
  Category.findByIdAndRemove = jest.fn();
  Category.find = jest.fn();
  Category.findOne = jest.fn();
  Category.aggregate = jest.fn();
  Category.__saveMock = saveMock;
  return Category;
});

const Category = require('../../../models/Category');
const controller = require('../../../controllers/categoryController');

describe('categoryController', () => {
  let errorSpy;
  beforeAll(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => {
    errorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Category.__saveMock.mockResolvedValue(undefined);
  });

  describe('createCategory', () => {
    it('creates category (201)', async () => {
      const { req, res } = mockReqRes({ body: { title: 'Pizza', value: 'pizza' } });
      await controller.createCategory(req, res);
      expect(Category.__saveMock).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ status: true, message: 'Category successfully created' });
    });

    // controller logs and rethrows on error → expect rejection
    it('throws on save error', async () => {
      Category.__saveMock.mockRejectedValue(new Error('DB error'));
      const { req, res } = mockReqRes({ body: { title: 'Burgers' } });
      await expect(controller.createCategory(req, res)).rejects.toThrow('DB error');
    });
  });

  describe('updateCategory', () => {
    it('updates category (200)', async () => {
      Category.findByIdAndUpdate.mockResolvedValue({ _id: 'c1' });
      const { req, res } = mockReqRes({
        params: { id: 'c1' },
        body: { title: 'Updated', value: 'updated', imageUrl: 'img' }
      });
      await controller.updateCategory(req, res);
      expect(Category.findByIdAndUpdate).toHaveBeenCalledWith('c1', {
        title: 'Updated', value: 'updated', imageUrl: 'img'
      }, { new: true });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('404 when not found', async () => {
      Category.findByIdAndUpdate.mockResolvedValue(null);
      const { req, res } = mockReqRes({ params: { id: 'missing' }, body: {} });
      await controller.updateCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('500 on update error', async () => {
      Category.findByIdAndUpdate.mockRejectedValue(new Error('Upd error'));
      const { req, res } = mockReqRes({ params: { id: 'c1' }, body: {} });
      await controller.updateCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteCategory', () => {
    it('deletes category (200)', async () => {
      Category.findByIdAndRemove.mockResolvedValue({ _id: 'c1' });
      const { req, res } = mockReqRes({ params: { id: 'c1' } });
      await controller.deleteCategory(req, res);
      expect(Category.findByIdAndRemove).toHaveBeenCalledWith({ id: 'c1' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('500 on delete error', async () => {
      Category.findByIdAndRemove.mockRejectedValue(new Error('Del error'));
      const { req, res } = mockReqRes({ params: { id: 'c1' } });
      await controller.deleteCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAllCategories', () => {
    it('returns categories (200)', async () => {
      const list = [{ _id: 'c1' }, { _id: 'c2' }];
      Category.find.mockResolvedValue(list);
      const { req, res } = mockReqRes();
      await controller.getAllCategories(req, res);
      expect(Category.find).toHaveBeenCalledWith({ title: { $ne: "More" } }, { __v: 0 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(list);
    });

    it('500 on error', async () => {
      Category.find.mockRejectedValue(new Error('List error'));
      const { req, res } = mockReqRes();
      await controller.getAllCategories(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getRandomCategories', () => {
    it('returns random + more (200)', async () => {
      Category.aggregate.mockResolvedValue([{ _id: 'a' }, { _id: 'b' }]);
      Category.findOne.mockResolvedValue({ _id: 'more', value: 'more' });
      const { req, res } = mockReqRes();
      await controller.getRandomCategories(req, res);
      expect(Category.aggregate).toHaveBeenCalled();
      expect(Category.findOne).toHaveBeenCalledWith({ value: 'more' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('500 on error', async () => {
      Category.aggregate.mockRejectedValue(new Error('Agg error'));
      const { req, res } = mockReqRes();
      await controller.getRandomCategories(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
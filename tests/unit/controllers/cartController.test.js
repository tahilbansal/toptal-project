const { mockReqRes } = require('../../helpers/mockReqRes');

// Mock Cart model
jest.mock('../../../models/Cart', () => {
  const saveMock = jest.fn().mockResolvedValue();
  function Cart(doc) {
    Object.assign(this, doc);
    this.save = saveMock;
  }
  Cart.findOne = jest.fn();
  Cart.countDocuments = jest.fn();
  Cart.findOneAndDelete = jest.fn();
  Cart.find = jest.fn();
  Cart.deleteMany = jest.fn();
  Cart.__saveMock = saveMock;
  return Cart;
});

// Mock Food
jest.mock('../../../models/Food', () => ({}));

const Cart = require('../../../models/Cart');
const controller = require('../../../controllers/cartController');

describe('cartController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Cart.__saveMock.mockResolvedValue(undefined);
  });

  describe('addProductToCart', () => {
    it('increments existing product and returns count (201)', async () => {
        const existing = { quantity: 1, totalPrice: 10, save: jest.fn().mockResolvedValue() };
        Cart.findOne.mockResolvedValue(existing);

        Cart.countDocuments.mockResolvedValue(2);

        const { req, res } = mockReqRes({
        user: { id: 'u1' },
        body: { productId: 'p1', totalPrice: 5, quantity: 1 }
        });

        await controller.addProductToCart(req, res);

        expect(existing.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ status: true, count: 2 });
    });

    it('creates new cart entry when not existing (201)', async () => {
      Cart.findOne.mockResolvedValue(null);
      Cart.countDocuments
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);

      const { req, res } = mockReqRes({
        user: { id: 'u1' },
        body: { productId: 'p1', totalPrice: 10, quantity: 1, additives: [], instructions: '' }
      });

      await controller.addProductToCart(req, res);

      expect(Cart.__saveMock).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ status: true, count: 2 });
    });

    it('500 on error', async () => {
      Cart.findOne.mockRejectedValue(new Error('Add error'));
      const { req, res } = mockReqRes({ user: { id: 'u1' }, body: {} });
      await controller.addProductToCart(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('fetchUserCart', () => {
    it('returns populated cart (200)', async () => {
      const items = [{ _id: 'i1' }];
      Cart.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(items)
      });
      const { req, res } = mockReqRes({ user: { id: 'u1' } });
      await controller.fetchUserCart(req, res);
      expect(Cart.find).toHaveBeenCalledWith({ userId: 'u1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(items);
    });

    it('500 on error', async () => {
      Cart.find.mockImplementation(() => ({ populate: jest.fn().mockRejectedValue(new Error('Pop error')) }));
      const { req, res } = mockReqRes({ user: { id: 'u1' } });
      await controller.fetchUserCart(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('clearUserCart', () => {
    it('clears cart (200)', async () => {
      Cart.deleteMany.mockResolvedValue({ acknowledged: true });
      const { req, res } = mockReqRes({ user: { id: 'u1' } });
      await controller.clearUserCart(req, res);
      expect(Cart.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('500 on error', async () => {
      Cart.deleteMany.mockRejectedValue(new Error('Clr error'));
      const { req, res } = mockReqRes({ user: { id: 'u1' } });
      await controller.clearUserCart(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCartCount', () => {
    it('returns count (200)', async () => {
      Cart.countDocuments.mockResolvedValue(4);
      const { req, res } = mockReqRes({ user: { id: 'u1' } });
      await controller.getCartCount(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: true, cartCount: 4 });
    });

    it('500 on error', async () => {
      Cart.countDocuments.mockRejectedValue(new Error('Cnt error'));
      const { req, res } = mockReqRes({ user: { id: 'u1' } });
      await controller.getCartCount(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('decrementProductQuantity', () => {
    it('decrements quantity when > 1 (200)', async () => {
      const cartItem = { quantity: 2, totalPrice: 20, save: jest.fn().mockResolvedValue() };
      Cart.findOne.mockResolvedValue(cartItem);
      const { req, res } = mockReqRes({ user: { id: 'u1' }, body: { productId: 'p1' } });
      await controller.decrementProductQuantity(req, res);
      expect(cartItem.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: true, message: 'Product quantity decreased successfully' });
    });

    it('removes item when quantity is 1 (200)', async () => {
      const cartItem = { quantity: 1, totalPrice: 10 };
      Cart.findOne.mockResolvedValue(cartItem);
      Cart.findOneAndDelete.mockResolvedValue({ acknowledged: true });
      const { req, res } = mockReqRes({ user: { id: 'u1' }, body: { productId: 'p1' } });
      await controller.decrementProductQuantity(req, res);
      expect(Cart.findOneAndDelete).toHaveBeenCalledWith({ userId: 'u1', productId: 'p1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: true, message: 'Product removed from cart' });
    });

    it('404 when item not found', async () => {
      Cart.findOne.mockResolvedValue(null);
      const { req, res } = mockReqRes({ user: { id: 'u1' }, body: { productId: 'pX' } });
      await controller.decrementProductQuantity(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('500 on error', async () => {
      Cart.findOne.mockRejectedValue(new Error('Dec error'));
      const { req, res } = mockReqRes({ user: { id: 'u1' }, body: { productId: 'p1' } });
      await controller.decrementProductQuantity(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
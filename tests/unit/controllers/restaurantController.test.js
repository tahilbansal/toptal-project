const { mockReqRes } = require('../../helpers/mockReqRes');

jest.mock('../../../models/Restaurant', () => {
  const saveMock = jest.fn().mockResolvedValue();
  function Restaurant(doc) { Object.assign(this, doc); this.save = saveMock; }
  Restaurant.findOne = jest.fn();
  Restaurant.findById = jest.fn();
  Restaurant.findByIdAndRemove = jest.fn();
  Restaurant.aggregate = jest.fn();
  Restaurant.find = jest.fn();
  Restaurant.findByIdAndUpdate = jest.fn();
  Restaurant.__saveMock = saveMock;
  return Restaurant;
});
jest.mock('../../../models/User', () => ({
  findByIdAndUpdate: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../../../models/Orders', () => ({
  countDocuments: jest.fn(),
}));
jest.mock('../../../models/Payout', () => {
  const saveMock = jest.fn().mockResolvedValue();
  function Payout(doc) { Object.assign(this, doc); this.save = saveMock; }
  Payout.find = jest.fn();
  Payout.__saveMock = saveMock;
  return Payout;
});
jest.mock('../../../utils/payoutRequestEmail', () => jest.fn());

const Restaurant = require('../../../models/Restaurant');
const User = require('../../../models/User');
const Orders = require('../../../models/Orders');
const Payout = require('../../../models/Payout');
const payoutRequestEmail = require('../../../utils/payoutRequestEmail');
const controller = require('../../../controllers/restaurantController');

describe('restaurantController', () => {
    beforeAll(() => {
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
  beforeEach(() => {
    jest.clearAllMocks();
    Restaurant.__saveMock.mockResolvedValue();
    Payout.__saveMock.mockResolvedValue();
  });

  describe('addRestaurant', () => {
    it('400 on missing required fields', async () => {
      const { req, res } = mockReqRes({ user: { id: 'owner1' }, body: { title: 'R' } });
      await controller.addRestaurant(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 when owner already has restaurant', async () => {
      Restaurant.findOne.mockResolvedValue({ _id: 'r1' });
      const { req, res } = mockReqRes({
        user: { id: 'owner1' },
        body: { title: 'R', time: '30', imageUrl: 'i', code: 'C', logoUrl: 'l', coords: { latitude: 1, longitude: 1, address: 'a', title: 'R' } }
      });
      await controller.addRestaurant(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('201 on success', async () => {
      Restaurant.findOne.mockResolvedValue(null);
      User.findByIdAndUpdate.mockResolvedValue({ _id: 'owner1' });

      const { req, res } = mockReqRes({
        user: { id: 'owner1' },
        body: { title: 'R', time: '30', imageUrl: 'i', code: 'C', logoUrl: 'l', coords: { latitude: 1, longitude: 1, address: 'a', title: 'R' } }
      });
      await controller.addRestaurant(req, res);

      expect(Restaurant.__saveMock).toHaveBeenCalled();
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('owner1', { userType: 'Restaurant Owner' }, { new: true, runValidators: true });
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getRestaurantByOwner', () => {
    it('404 when not found', async () => {
      Restaurant.findOne.mockResolvedValue(null);
      const { req, res } = mockReqRes({ user: { id: 'owner1' } });
      await controller.getRestaurantByOwner(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('200 when found', async () => {
      Restaurant.findOne.mockResolvedValue({ _id: 'r1' });
      const { req, res } = mockReqRes({ user: { id: 'owner1' } });
      await controller.getRestaurantByOwner(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getRandomRestaurants', () => {
    it('uses code when provided (200)', async () => {
      Restaurant.aggregate.mockResolvedValueOnce([{ _id: 'r1' }]);
      const { req, res } = mockReqRes({ params: { code: 'X' } });
      await controller.getRandomRestaurants(req, res);
      expect(Restaurant.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getAllRandomRestaurants', () => {
    it('uses code filter when provided (200)', async () => {
      // ensure all aggregate calls return non-empty so controller won’t 404
      Restaurant.aggregate
        .mockResolvedValueOnce([{ _id: 'r1' }])
        .mockResolvedValueOnce([{ _id: 'r2' }]);

      const { req, res } = mockReqRes({ params: { code: 'X' } });
      await controller.getAllRandomRestaurants(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('fallback to all when empty (200)', async () => {
      Restaurant.aggregate
        .mockResolvedValueOnce([])               // code-filtered empty
        .mockResolvedValueOnce([{ _id: 'r2' }]); // fallback non-empty
      const { req, res } = mockReqRes({ params: {} });
      await controller.getAllRandomRestaurants(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('serviceAvailability', () => {
    it('toggles isAvailable (200)', async () => {
      const r = { isAvailable: true, save: jest.fn().mockResolvedValue() };
      Restaurant.findById.mockResolvedValue(r);
      const { req, res } = mockReqRes({ params: { id: 'r1' } });
      await controller.serviceAvailability(req, res);
      expect(r.isAvailable).toBe(false);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('404 when not found', async () => {
      Restaurant.findById.mockResolvedValue(null);
      const { req, res } = mockReqRes({ params: { id: 'r1' } });
      await controller.serviceAvailability(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteRestaurant', () => {
    it('deletes (200) using params object', async () => {
      Restaurant.findByIdAndRemove.mockResolvedValue({ acknowledged: true });
      const { req, res } = mockReqRes({ params: { id: 'r1' } });
      await controller.deleteRestaurant(req, res);
      expect(Restaurant.findByIdAndRemove).toHaveBeenCalledWith({ id: 'r1' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('500 on error', async () => {
      Restaurant.findByIdAndRemove.mockRejectedValue(new Error('del err'));
      const { req, res } = mockReqRes({ params: { id: 'r1' } });
      await controller.deleteRestaurant(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getRestaurant', () => {
    it('200 when found', async () => {
      Restaurant.findById.mockResolvedValue({ _id: 'r1' });
      const { req, res } = mockReqRes({ params: { id: 'r1' } });
      await controller.getRestaurant(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('404 when not found', async () => {
      Restaurant.findById.mockResolvedValue(null);
      const { req, res } = mockReqRes({ params: { id: 'x' } });
      await controller.getRestaurant(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getStats', () => {
    it('returns stats (200)', async () => {
      const data = { earnings: 123.456, owner: 'u1' };
      Restaurant.findById.mockResolvedValue(data);
      Orders.countDocuments
        .mockResolvedValueOnce(5)   // ordersTotal
        .mockResolvedValueOnce(5)   // deliveryRevenue (same call in code)
        .mockResolvedValueOnce(1)   // cancelledOrders
        .mockResolvedValueOnce(2);  // processingOrders
      const sorted = [{ _id: 'p1' }];
      Payout.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(sorted) });
      User.findById.mockResolvedValue({ fcm: 'token' });

      const { req, res } = mockReqRes({ params: { id: 'r1' } });
      await controller.getStats(req, res);

      expect(Restaurant.findById).toHaveBeenCalledWith('r1', { coords: 0 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ordersTotal: 5,
        cancelledOrders: 1,
        revenueTotal: expect.any(Number),
        processingOrders: 2,
      }));
    });
  });

  describe('createPayout', () => {
    it('404 when user not found', async () => {
      require('../../../models/Restaurant').findById.mockResolvedValue({ owner: 'uX' });
      User.findById.mockResolvedValue(null);

      const { req, res } = mockReqRes({
        body: { amount: 10, restaurant: 'r1', accountNumber: '1', accountName: 'n', accountBank: 'b', paymentMethod: 'pm' }
      });
      await controller.createPayout(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('201 on success', async () => {
      require('../../../models/Restaurant').findById.mockResolvedValue({ owner: 'u1' });
      User.findById.mockResolvedValue({ email: 'a@b.com', username: 'U' });

      const { req, res } = mockReqRes({
        body: { amount: 10, restaurant: 'r1', accountNumber: '1', accountName: 'n', accountBank: 'b', paymentMethod: 'pm' }
      });
      await controller.createPayout(req, res);

      expect(payoutRequestEmail).toHaveBeenCalledWith('a@b.com', 'U', 10);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getRestarantFinance', () => {
    it('200 returns finance', async () => {
      Restaurant.findById.mockResolvedValue({ _id: 'r1', earnings: 10 });
      const { req, res } = mockReqRes({ params: { id: 'r1' } });
      await controller.getRestarantFinance(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('404 when not found', async () => {
      Restaurant.findById.mockResolvedValue(null);
      const { req, res } = mockReqRes({ params: { id: 'r1' } });
      await controller.getRestarantFinance(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
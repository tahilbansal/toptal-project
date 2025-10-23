const { mockReqRes } = require('../../helpers/mockReqRes');

jest.mock('../../../models/Orders', () => {
  const saveMock = jest.fn().mockResolvedValue();
  function Order(doc) { Object.assign(this, doc); this.save = saveMock; this.id = 'o1'; }
  Order.findById = jest.fn();
  Order.find = jest.fn();
  Order.findByIdAndDelete = jest.fn();
  Order.findByIdAndUpdate = jest.fn();
  Order.__saveMock = saveMock;
  return Order;
});
jest.mock('../../../models/Coupon', () => ({ findOne: jest.fn() }));
jest.mock('../../../models/Driver', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../../../models/Restaurant', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../../../models/User', () => ({ findById: jest.fn() }));
jest.mock('../../../utils/couponTotalHelper', () => ({ computeOrderTotals: jest.fn(() => ({
  itemsTotal: 20, discountPercent: 10, discountAmount: 2, grandTotal: 26
})) }));
jest.mock('../../../utils/driverUpdate', () => ({
  updateDriver: jest.fn(),
  updateRestaurant: jest.fn(),
  updateUser: jest.fn(),
}));
jest.mock('../../../utils/sendNotification', () => jest.fn());
jest.mock('../../../utils/sendToTopic', () => jest.fn());
jest.mock('firebase-admin', () => ({
  database: () => ({}),
}));

const Order = require('../../../models/Orders');
const Coupon = require('../../../models/Coupon');
const Driver = require('../../../models/Driver');
const Restaurant = require('../../../models/Restaurant');
const User = require('../../../models/User');
const { computeOrderTotals } = require('../../../utils/couponTotalHelper');
const sendNotification = require('../../../utils/sendNotification');
const sendNotificationToTopic = require('../../../utils/sendToTopic');
const controller = require('../../../controllers/orderController');

describe('orderController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Order.__saveMock.mockResolvedValue();
  });

  describe('placeOrder', () => {
    it('creates order with coupon and server totals (201)', async () => {
      Coupon.findOne.mockResolvedValue({ _id: 'c1', code: 'WELCOME10' });
      const { req, res } = mockReqRes({
        body: {
          userId: 'u1',
          orderItems: [{ foodId: 'f1', price: 10, quantity: 2 }],
          deliveryFee: 4,
          tipAmount: 2,
          couponCode: 'WELCOME10',
          paymentMethod: 'cash',
          restaurantId: 'r1',
          restaurantCoords: {},
          recipientCoords: {},
          deliveryAddress: 'addr',
          restaurantAddress: 'addr'
        }
      });

      await controller.placeOrder(req, res);

      expect(computeOrderTotals).toHaveBeenCalled();
      expect(Order.__saveMock).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ status: true, message: 'Order placed successfully', orderId: 'o1' });
    });

    it('500 on error', async () => {
      Order.__saveMock.mockRejectedValue(new Error('save err'));
      const { req, res } = mockReqRes({ body: { orderItems: [], deliveryFee: 0 } });
      await controller.placeOrder(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getOrderDetails', () => {
    it('returns populated order (200)', async () => {
      const order = { _id: 'o1', orderStatus: 'Placed' };
      Order.findById.mockReturnValue({
        select: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => ({
                  populate: () => Promise.resolve(order)
                })
              })
            })
          })
        })
      });

      const { req, res } = mockReqRes({ params: { id: 'o1' } });
      await controller.getOrderDetails(req, res);
      expect(Order.findById).toHaveBeenCalledWith('o1');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getUserOrders', () => {
    it('returns user orders (200)', async () => {
      const list = [{ _id: 'o1' }];
      Order.find.mockReturnValue({
        populate: () => ({ sort: jest.fn().mockResolvedValue(list) })
      });

      const { req, res } = mockReqRes({ user: { id: 'u1' }, query: {} });
      await controller.getUserOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({ userId: 'u1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(list);
    });
  });

  describe('deleteOrder', () => {
    it('deletes order (200)', async () => {
      Order.findByIdAndDelete.mockResolvedValue({ acknowledged: true });
      const { req, res } = mockReqRes({ params: { orderId: 'o1' } });
      await controller.deleteOrder(req, res);
      expect(Order.findByIdAndDelete).toHaveBeenCalledWith('o1');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('rateOrder', () => {
    it('404 when not found', async () => {
      Order.findByIdAndUpdate.mockResolvedValue(null);
      const { req, res } = mockReqRes({ params: { id: 'oX' }, body: { rating: 5, feedback: 'good' } });
      await controller.rateOrder(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('200 on success', async () => {
      Order.findByIdAndUpdate.mockResolvedValue({ _id: 'o1' });
      const { req, res } = mockReqRes({ params: { id: 'o1' }, body: { rating: 5, feedback: 'good' } });
      await controller.rateOrder(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('updateOrderStatus', () => {
    it('404 when order missing', async () => {
      Order.findById.mockResolvedValue(null);
      const { req, res } = mockReqRes({ params: { id: 'o1' }, body: { orderStatus: 'Processing' }, user: { id: 'u1', userType: 'Restaurant Owner' } });
      await controller.updateOrderStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('403 for customer invalid transition', async () => {
      Order.findById.mockResolvedValue({ userId: 'u1', orderStatus: 'Placed', save: jest.fn().mockResolvedValue() });
      const { req, res } = mockReqRes({ params: { id: 'o1' }, body: { orderStatus: 'Processing' }, user: { id: 'u1', userType: 'Customer' } });
      await controller.updateOrderStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('200 for restaurant owner valid transition', async () => {
      const orderDoc = { userId: 'cust', orderStatus: 'Placed', save: jest.fn().mockResolvedValue() };
      Order.findById.mockResolvedValue(orderDoc);
      const { req, res } = mockReqRes({ params: { id: 'o1' }, body: { orderStatus: 'Processing' }, user: { id: 'owner', userType: 'Restaurant Owner' } });
      await controller.updateOrderStatus(req, res);
      expect(orderDoc.orderStatus).toBe('Processing');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('updatePaymentStatus', () => {
    it('200 when updated and populated', async () => {
      const updated = { _id: 'o1' };
      Order.findByIdAndUpdate.mockReturnValue({
        select: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => Promise.resolve(updated)
              })
            })
          })
        })
      });

      const { req, res } = mockReqRes({ params: { id: 'o1' } });
      await controller.updatePaymentStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('404 when not found', async () => {
      Order.findByIdAndUpdate.mockReturnValue({
        select: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => Promise.resolve(null)
              })
            })
          })
        })
      });

      const { req, res } = mockReqRes({ params: { id: 'oX' } });
      await controller.updatePaymentStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('lists and driver ops', () => {
    it('getRestaurantOrders returns list (200)', async () => {
      Order.find.mockReturnValue({
        select: () => ({ populate: () => ({ populate: () => ({ populate: () => Promise.resolve([{ _id: 'o1' }]) }) }) })
      });
      const { req, res } = mockReqRes({ params: { id: 'r1' }, query: { status: 'placed' } });
      await controller.getRestaurantOrders(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('getRestaurantOrdersList returns list (200)', async () => {
      Order.find.mockReturnValue({
        select: () => ({ populate: () => ({ populate: () => ({ populate: () => ({ populate: () => Promise.resolve([{ _id: 'o1' }]) }) }) }) })
      });
      const { req, res } = mockReqRes({ params: { id: 'r1' }, query: { status: 'delivered' } });
      await controller.getRestaurantOrdersList(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('getNearbyOrders returns list (200)', async () => {
      Order.find.mockReturnValue({
        select: () => ({ populate: () => ({ populate: () => ({ populate: () => ({ populate: () => Promise.resolve([{ _id: 'o1' }]) }) }) }) })
      });
      const { req, res } = mockReqRes({ params: { status: 'Placed' } });
      await controller.getNearbyOrders(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('getPickedOrders returns list (200)', async () => {
      Order.find.mockReturnValue({
        select: () => ({ populate: () => ({ populate: () => ({ populate: () => ({ populate: () => Promise.resolve([{ _id: 'o1' }]) }) }) }) })
      });
      const { req, res } = mockReqRes({ params: { status: 'Delivered', driver: 'd1' } });
      await controller.getPickedOrders(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('addDriver updates order and notifies (200)', async () => {
      const updatedOrder = { _id: 'o1', userId: { _id: 'u1' } };
      Order.findByIdAndUpdate.mockReturnValue({
        select: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => Promise.resolve(updatedOrder)
              })
            })
          })
        })
      });
      User.findById.mockResolvedValue({ fcm: 'token' });

      const { req, res } = mockReqRes({ params: { id: 'o1', driver: 'd1' } });
      await controller.addDriver(req, res);
      expect(User.findById).toHaveBeenCalledWith('u1', { fcm: 1 });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('markAsDelivered updates earnings and driver stats (200)', async () => {
      const updatedOrder = { _id: 'o1', userId: { _id: 'u1' }, restaurantId: { _id: 'r1' }, orderTotal: 10, deliveryFee: 3 };
      Order.findByIdAndUpdate.mockReturnValue({
        select: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => Promise.resolve(updatedOrder)
              })
            })
          })
        })
      });
      Restaurant.findByIdAndUpdate.mockResolvedValue({ _id: 'r1' });
      const driverDoc = { totalDeliveries: 0, totalEarnings: 0, save: jest.fn().mockResolvedValue() };
      Driver.findOne.mockResolvedValue(driverDoc);
      User.findById.mockResolvedValue({ fcm: 'token' });

      const { req, res } = mockReqRes({ params: { id: 'o1' }, user: { id: 'driverU' } });
      await controller.markAsDelivered(req, res);
      expect(Restaurant.findByIdAndUpdate).toHaveBeenCalledWith('r1', { $inc: { earnings: 10 } }, { new: true });
      expect(driverDoc.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('processOrder "Preparing" notifies (200)', async () => {
      const updatedOrder = { _id: 'o1', userId: { _id: 'u1' } };
      Order.findByIdAndUpdate.mockReturnValue({
        select: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => Promise.resolve(updatedOrder)
              })
            })
          })
        })
      });
      User.findById.mockResolvedValue({ fcm: 'token' });

      const { req, res } = mockReqRes({ params: { id: 'o1', status: 'Preparing' } });
      await controller.processOrder(req, res);
      expect(sendNotification).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('processOrder "Ready" sends topic (200)', async () => {
      const updatedOrder = { _id: 'o1', userId: { _id: 'u1' } };
      Order.findByIdAndUpdate.mockReturnValue({
        select: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => Promise.resolve(updatedOrder)
              })
            })
          })
        })
      });
      User.findById.mockResolvedValue({ fcm: 'token' });

      const { req, res } = mockReqRes({ params: { id: 'o1', status: 'Ready' } });
      await controller.processOrder(req, res);
      expect(sendNotificationToTopic).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
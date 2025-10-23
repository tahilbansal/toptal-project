const { mockReqRes } = require('../../helpers/mockReqRes');

const makeFindChain = (items = []) => ({
  select: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  sort: jest.fn().mockResolvedValue(items),
});

// Mocks
jest.mock('../../../models/User', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../../../models/Restaurant', () => ({
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../../../models/Food', () => ({
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../../../models/Coupon', () => ({
  create: jest.fn(),
}));

// Require mocked modules and controller
const User = require('../../../models/User');
const Restaurant = require('../../../models/Restaurant');
const Food = require('../../../models/Food');
const Coupon = require('../../../models/Coupon');
const adminController = require('../../../controllers/adminController');

describe('adminController', () => {
  beforeAll(() => {
    process.env.SECRET = 'test-secret';
    process.env.ADMIN_EMAIL = 'admin@yourapp.com';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Users
  test('adminCreateUser: creates user (201)', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      toObject: () => ({ _id: 'u1', email: 'x@y.com', userType: 'Customer' }),
    });

    const { req, res } = mockReqRes({
      body: { username: 'x', email: 'x@y.com', password: 'P@ss1', userType: 'Customer' },
    });

    await adminController.adminCreateUser(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'x@y.com' });
    expect(User.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: true }));
  });

  test('adminCreateUser: duplicate email (409)', async () => {
    User.findOne.mockResolvedValue({ _id: 'exists' });
    const { req, res } = mockReqRes({
      body: { username: 'x', email: 'dup@y.com', password: 'P@ss1' },
    });
    await adminController.adminCreateUser(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('adminGetUsers: returns list + pagination (200)', async () => {
    const items = [{ _id: 'u1' }, { _id: 'u2' }];
    User.find.mockReturnValue(makeFindChain(items));
    User.countDocuments.mockResolvedValue(2);

    const { req, res } = mockReqRes({ query: { role: 'Driver', page: '1', limit: '20' } });
    await adminController.adminGetUsers(req, res);

    expect(User.find).toHaveBeenCalledWith({ userType: 'Driver' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: items, pagination: expect.any(Object) })
    );
  });

  test('adminUpdateUser: email conflict (409)', async () => {
    User.findOne.mockResolvedValue({ _id: 'other' });
    const { req, res } = mockReqRes({ params: { id: 'u1' }, body: { email: 'taken@y.com' } });
    await adminController.adminUpdateUser(req, res);
    expect(User.findOne).toHaveBeenCalledWith({ email: 'taken@y.com', _id: { $ne: 'u1' } });
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('adminUpdateUser: success (200)', async () => {
    User.findOne.mockResolvedValue(null);
    User.findByIdAndUpdate.mockResolvedValue({
      toObject: () => ({ _id: 'u1', email: 'new@y.com' }),
    });
    const { req, res } = mockReqRes({
      params: { id: 'u1' },
      body: { email: 'new@y.com', password: 'NewP@ss' },
    });
    await adminController.adminUpdateUser(req, res);
    expect(User.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('adminSetBlocked: cannot block built-in admin (403)', async () => {
    User.findById.mockResolvedValue({ email: 'admin@yourapp.com' });
    const { req, res } = mockReqRes({ params: { id: 'built-in' }, body: { blocked: true } });
    await adminController.adminSetBlocked(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('adminSetBlocked: success (200)', async () => {
    const userDoc = {
      blocked: false,
      save: jest.fn().mockResolvedValue(undefined),
      toObject: () => ({ _id: 'u1', email: 'x@y.com', blocked: true }),
      email: 'x@y.com',
    };
    User.findById.mockResolvedValue(userDoc);
    const { req, res } = mockReqRes({ params: { id: 'u1' }, body: { blocked: true } });
    await adminController.adminSetBlocked(req, res);
    expect(userDoc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('adminDeleteUser: cannot delete built-in admin (403)', async () => {
    User.findById.mockResolvedValue({ email: 'admin@yourapp.com' });
    const { req, res } = mockReqRes({ params: { id: 'uA' } });
    await adminController.adminDeleteUser(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('adminDeleteUser: not found (404)', async () => {
    User.findById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: 'missing' } });
    await adminController.adminDeleteUser(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('adminDeleteUser: success (200)', async () => {
    User.findById.mockResolvedValue({ email: 'x@y.com' });
    User.findByIdAndDelete.mockResolvedValue({ acknowledged: true });
    const { req, res } = mockReqRes({ params: { id: 'u1' } });
    await adminController.adminDeleteUser(req, res);
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('u1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // Restaurants
  test('adminCreateRestaurant: owner not found (404)', async () => {
    User.findById.mockResolvedValue(null);
    const { req, res } = mockReqRes({
      body: {
        owner: 'u1',
        title: 'R',
        time: '30',
        imageUrl: 'img',
        code: 'C',
        logoUrl: 'logo',
        coords: { latitude: 1, longitude: 2, address: 'addr', title: 'R' },
      },
    });
    await adminController.adminCreateRestaurant(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('adminCreateRestaurant: success (201)', async () => {
    User.findById.mockResolvedValue({ _id: 'u1' });
    Restaurant.findOne.mockResolvedValue(null);
    Restaurant.create.mockResolvedValue({ _id: 'r1', title: 'R' });
    User.findByIdAndUpdate.mockResolvedValue({ _id: 'u1', userType: 'Restaurant Owner' });
    const { req, res } = mockReqRes({
      body: {
        owner: 'u1',
        title: 'R',
        time: '30',
        imageUrl: 'img',
        code: 'C',
        logoUrl: 'logo',
        coords: { latitude: 1, longitude: 2, address: 'addr', title: 'R' },
      },
    });
    await adminController.adminCreateRestaurant(req, res);
    expect(Restaurant.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('adminGetRestaurants: returns list + pagination (200)', async () => {
    const items = [{ _id: 'r1' }];
    Restaurant.find.mockReturnValue(makeFindChain(items));
    Restaurant.countDocuments.mockResolvedValue(1);
    const { req, res } = mockReqRes({ query: { page: '1', limit: '10' } });
    await adminController.adminGetRestaurants(req, res);
    expect(Restaurant.find).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('adminUpdateRestaurant: owner invalid (400)', async () => {
    User.findById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: 'r1' }, body: { owner: 'new-owner' } });
    await adminController.adminUpdateRestaurant(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('adminSetRestaurantBlocked: success (200)', async () => {
    const rDoc = { _id: 'r1', blocked: false, save: jest.fn().mockResolvedValue() };
    Restaurant.findById.mockResolvedValue(rDoc);
    const { req, res } = mockReqRes({ params: { id: 'r1' }, body: { blocked: true } });
    await adminController.adminSetRestaurantBlocked(req, res);
    expect(rDoc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('adminDeleteRestaurant: not found (404)', async () => {
    Restaurant.findById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: 'rX' } });
    await adminController.adminDeleteRestaurant(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // Foods
  test('adminCreateFood: restaurant not found (404)', async () => {
    Restaurant.findById.mockResolvedValue(null);
    const { req, res } = mockReqRes({
      body: {
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
        imageUrl: ['img'],
      },
    });
    await adminController.adminCreateFood(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('adminCreateFood: success (201)', async () => {
    Restaurant.findById.mockResolvedValue({ _id: 'r1' });
    Food.create.mockResolvedValue({ _id: 'f1', title: 'Dish' });
    const { req, res } = mockReqRes({
      body: {
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
        imageUrl: ['img'],
      },
    });
    await adminController.adminCreateFood(req, res);
    expect(Food.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('adminGetFoods: returns list + pagination (200)', async () => {
    const items = [{ _id: 'f1' }];
    Food.find.mockReturnValue(makeFindChain(items));
    Food.countDocuments.mockResolvedValue(1);
    const { req, res } = mockReqRes({ query: { page: '1', limit: '10' } });
    await adminController.adminGetFoods(req, res);
    expect(Food.find).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('adminUpdateFood: not found (404)', async () => {
    Food.findByIdAndUpdate.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: 'fX' }, body: { title: 'new' } });
    await adminController.adminUpdateFood(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('adminSetFoodBlocked: success (200)', async () => {
    const fDoc = { _id: 'f1', blocked: false, save: jest.fn().mockResolvedValue() };
    Food.findById.mockResolvedValue(fDoc);
    const { req, res } = mockReqRes({ params: { id: 'f1' }, body: { blocked: true } });
    await adminController.adminSetFoodBlocked(req, res);
    expect(fDoc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // Coupons
  test('adminCreateCoupon: invalid percent (400)', async () => {
    const { req, res } = mockReqRes({ body: { code: 'WELCOME', percentOff: 120 } });
    await adminController.adminCreateCoupon(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('adminCreateCoupon: duplicate code (409)', async () => {
    Coupon.create.mockRejectedValue({ code: 11000 });
    const { req, res } = mockReqRes({ body: { code: 'WELCOME', percentOff: 10 } });
    await adminController.adminCreateCoupon(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('adminCreateCoupon: success (201)', async () => {
    Coupon.create.mockResolvedValue({ _id: 'c1', code: 'WELCOME10' });
    const { req, res } = mockReqRes({
      body: { code: 'WELCOME10', percentOff: 10, active: true, maxDiscount: 5 },
    });
    await adminController.adminCreateCoupon(req, res);
    expect(Coupon.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WELCOME10', percentOff: 10 })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
const { mockReqRes } = require('../../helpers/mockReqRes');

jest.mock('../../../models/User', () => ({
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
}));
jest.mock('crypto-js', () => ({
  AES: { encrypt: jest.fn(() => ({ toString: () => 'enc-pass' })) },
}));
jest.mock('firebase-admin', () => ({
  messaging: () => ({ subscribeToTopic: jest.fn().mockResolvedValue() }),
}));

const User = require('../../../models/User');
const controller = require('../../../controllers/userController');

describe('userController', () => {
  beforeAll(() => {
    process.env.SECRET = 'secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateUser', () => {
    it('encrypts password and updates user (200)', async () => {
      const updated = { _doc: { password: 'hash', __v: 0, createdAt: 'd', name: 'John' } };
      User.findByIdAndUpdate.mockResolvedValue(updated);

      const { req, res } = mockReqRes({
        user: { id: 'u1' },
        body: { password: 'plain', name: 'John' }
      });

      await controller.updateUser(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u1', { $set: { password: 'enc-pass', name: 'John' } }, { new: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ name: 'John' });
    });

    it('500 on update error', async () => {
      User.findByIdAndUpdate.mockRejectedValue(new Error('upd err'));
      const { req, res } = mockReqRes({ user: { id: 'u1' }, body: {} });
      await controller.updateUser(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteUser', () => {
    it('deletes user (200)', async () => {
      User.findByIdAndDelete.mockResolvedValue({ acknowledged: true });
      const { req, res } = mockReqRes({ user: { id: 'u1' } });
      await controller.deleteUser(req, res);
      expect(User.findByIdAndDelete).toHaveBeenCalledWith('u1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('500 on delete error', async () => {
      User.findByIdAndDelete.mockRejectedValue(new Error('del err'));
      const { req, res } = mockReqRes({ user: { id: 'u1' } });
      await controller.deleteUser(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('verifyAccount', () => {
    it('verifies OTP and updates user (200)', async () => {
      const doc = {
        _doc: { password: 'p', __v: 0, otp: '111111', createdAt: 'd', email: 'a@b.com' },
        otp: '123456',
        verification: false,
        save: jest.fn().mockResolvedValue(),
      };
      User.findById.mockResolvedValue(doc);

      const { req, res } = mockReqRes({ user: { id: 'u1' }, params: { otp: '123456' } });
      await controller.verifyAccount(req, res);

      expect(doc.verification).toBe(true);
      expect(doc.otp).toBe('none');
      expect(doc.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ email: 'a@b.com' });
    });

    it('404 when user not found', async () => {
      User.findById.mockResolvedValue(null);
      const { req, res } = mockReqRes({ user: { id: 'u1' }, params: { otp: '123456' } });
      await controller.verifyAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('400 when OTP mismatch', async () => {
      User.findById.mockResolvedValue({
        _doc: { password: 'p', __v: 0, otp: '111111', createdAt: 'd' },
        otp: '000000',
        save: jest.fn(),
      });
      const { req, res } = mockReqRes({ user: { id: 'u1' }, params: { otp: '123456' } });
      await controller.verifyAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('verifyPhone', () => {
    it('sets phone verification (200)', async () => {
      const user = {
        _doc: { password: 'p', __v: 0, otp: '111111', createdAt: 'd', phone: '' },
        phoneVerification: false,
        phone: '',
        save: jest.fn().mockResolvedValue(),
      };
      User.findById.mockResolvedValue(user);

      const { req, res } = mockReqRes({ user: { id: 'u1' }, params: { phone: '9999999999' } });
      await controller.verifyPhone(req, res);
      expect(user.phoneVerification).toBe(true);
      expect(user.phone).toBe('9999999999');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('404 on missing user', async () => {
      User.findById.mockResolvedValue(null);
      const { req, res } = mockReqRes({ user: { id: 'u1' }, params: { phone: '1' } });
      await controller.verifyPhone(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getUser', () => {
    it('returns user data (200)', async () => {
      const populated = { _doc: { password: 'p', __v: 0, createdAt: 'd', email: 'a@b.com' } };
      User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(populated) });

      const { req, res } = mockReqRes({ user: { id: 'u1' } });
      await controller.getUser(req, res);

      expect(User.findById).toHaveBeenCalledWith('u1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ email: 'a@b.com' });
    });

    it('500 on error', async () => {
      User.findById.mockImplementation(() => ({ populate: jest.fn().mockRejectedValue(new Error('pop err')) }));
      const { req, res } = mockReqRes({ user: { id: 'u1' } });
      await controller.getUser(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAdminNumber', () => {
    it('returns first admin phone (200)', async () => {
      User.find.mockResolvedValue([{ phone: '12345' }]);
      const { req, res } = mockReqRes();
      await controller.getAdminNumber(req, res);
      expect(User.find).toHaveBeenCalledWith({ userType: 'Admin' }, { phone: 1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith('12345');
    });

    it('500 on error', async () => {
      User.find.mockRejectedValue(new Error('err'));
      const { req, res } = mockReqRes();
      await controller.getAdminNumber(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAllUsers', () => {
    it('returns all users (200)', async () => {
      const list = [{ _id: 'u1' }];
      User.find.mockResolvedValue(list);
      const { req, res } = mockReqRes();
      await controller.getAllUsers(req, res);
      expect(User.find).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(list);
    });
  });

  describe('updateFcm', () => {
    it('updates FCM and subscribes driver (200)', async () => {
      const user = { userType: 'Driver', fcm: '', save: jest.fn().mockResolvedValue() };
      User.findById.mockResolvedValue(user);

      const { req, res } = mockReqRes({ user: { id: 'u1' }, params: { token: 'fcm-token' } });
      await controller.updateFcm(req, res);

      expect(user.fcm).toBe('fcm-token');
      expect(user.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('404 when user not found', async () => {
      User.findById.mockResolvedValue(null);
      const { req, res } = mockReqRes({ user: { id: 'u1' }, params: { token: 'x' } });
      await controller.updateFcm(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
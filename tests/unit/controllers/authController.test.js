const { mockReqRes } = require('../../helpers/mockReqRes');

jest.mock('../../../models/User', () => {
  const saveMock = jest.fn().mockResolvedValue();
  function User(doc) {
    Object.assign(this, doc);
    this.save = saveMock;
  }
  User.findOne = jest.fn();
  User.__saveMock = saveMock;
  return User;
});

jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn((txt, key) => `enc(${txt})`),
    decrypt: jest.fn(() => ({ toString: () => 'decrypted' }))
  },
  enc: { Utf8: 'Utf8' }
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'token123')
}));

jest.mock('../../../utils/otpGenerator', () => jest.fn(() => 123456));
jest.mock('../../../utils/emailVerification', () => jest.fn());

const User = require('../../../models/User');
const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');
const generateOtp = require('../../../utils/otpGenerator');
const sendVerificationEmail = require('../../../utils/emailVerification');
const controller = require('../../../controllers/authContoller');

describe('authContoller', () => {
  beforeAll(() => {
    process.env.SECRET = 'secret';
    process.env.JWT_SEC = 'jwt';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    User.__saveMock.mockResolvedValue(undefined);
  });

  describe('createUser', () => {
    it('400 on invalid email', async () => {
      const { req, res } = mockReqRes({ body: { email: 'bad', password: '12345678' } });
      await controller.createUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 on short password', async () => {
      const { req, res } = mockReqRes({ body: { email: 'a@b.com', password: '123' } });
      await controller.createUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 when email exists', async () => {
      User.findOne.mockResolvedValue({ _id: 'u1' });
      const { req, res } = mockReqRes({ body: { username: 'x', email: 'a@b.com', password: '12345678' } });
      await controller.createUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('201 on success', async () => {
      User.findOne.mockResolvedValue(null);
      const { req, res } = mockReqRes({
        body: { username: 'x', email: 'a@b.com', password: '12345678', fcm: 't' }
      });
      await controller.createUser(req, res);
      expect(generateOtp).toHaveBeenCalled();
      expect(User.__saveMock).toHaveBeenCalled();
      expect(sendVerificationEmail).toHaveBeenCalledWith('a@b.com', 123456);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('500 on save error', async () => {
      User.findOne.mockResolvedValue(null);
      User.__saveMock.mockRejectedValue(new Error('Save error'));
      const { req, res } = mockReqRes({
        body: { username: 'x', email: 'a@b.com', password: '12345678', fcm: 't' }
      });
      await controller.createUser(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('loginUser', () => {
    it('400 invalid email', async () => {
      const { req, res } = mockReqRes({ body: { email: 'bad', password: '12345678' } });
      await controller.loginUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 short password', async () => {
      const { req, res } = mockReqRes({ body: { email: 'a@b.com', password: '123' } });
      await controller.loginUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('401 when user not found', async () => {
      User.findOne.mockResolvedValue(null);
      const { req, res } = mockReqRes({ body: { email: 'a@b.com', password: '12345678' } });
      await controller.loginUser(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('401 wrong password', async () => {
      User.findOne.mockResolvedValue({
        _id: 'u1',
        email: 'a@b.com',
        userType: 'Customer',
        fcm: 't',
        password: 'encrypted',
        _doc: { password: 'encrypted', otp: '111111' }
      });
      // Decrypt returns different value than provided password
      CryptoJS.AES.decrypt.mockReturnValue({ toString: () => 'not-the-same' });
      const { req, res } = mockReqRes({ body: { email: 'a@b.com', password: '12345678' } });
      await controller.loginUser(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('200 on success returns token', async () => {
      User.findOne.mockResolvedValue({
        _id: 'u1',
        email: 'a@b.com',
        userType: 'Customer',
        fcm: 't',
        password: 'encrypted',
        _doc: { _id: 'u1', email: 'a@b.com', userType: 'Customer', fcm: 't', password: 'encrypted', otp: '111111' }
      });
      CryptoJS.AES.decrypt.mockReturnValue({ toString: () => '12345678' });

      const { req, res } = mockReqRes({ body: { email: 'a@b.com', password: '12345678' } });
      await controller.loginUser(req, res);

      expect(jwt.sign).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ userToken: 'token123' }));
    });

    it('500 on error', async () => {
      User.findOne.mockRejectedValue(new Error('Find error'));
      const { req, res } = mockReqRes({ body: { email: 'a@b.com', password: '12345678' } });
      await controller.loginUser(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
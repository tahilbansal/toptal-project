jest.mock('../../../models/User', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('crypto-js', () => ({
  AES: { encrypt: jest.fn(() => ({ toString: () => 'enc-pass' })) },
}));

const User = require('../../../models/User');
const { seedBuiltInAdmin } = require('../../../utils/seedAdmin');

describe('seedAdmin', () => {
  beforeAll(() => {
    process.env.SECRET = 'secret';
    process.env.ADMIN_EMAIL = 'admin@yourapp.com';
    process.env.ADMIN_PASSWORD = 'adminpass';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing if admin exists', async () => {
    User.findOne.mockResolvedValue({ _id: 'exists' });
    await seedBuiltInAdmin();
    expect(User.create).not.toHaveBeenCalled();
  });

  it('creates admin when missing', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: 'newAdmin' });

    await seedBuiltInAdmin();

    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      username: 'Administrator',
      email: 'admin@yourapp.com',
      password: 'enc-pass',
      userType: 'Admin',
      phoneVerification: true,
      verification: true,
      blocked: false,
    }));
  });
});
jest.mock('crypto-js', () => ({
  AES: { decrypt: jest.fn(() => ({ toString: () => 'plain-text' })) },
  enc: { Utf8: 'Utf8' },
}));
const CryptoJS = require('crypto-js');

describe('passwordDecrypt', () => {
  beforeAll(() => {
    process.env.SECRET = 'secret';
  });

  it('decrypts using AES and SECRET', () => {
    const decrypt = require('../../../utils/passwordDecrypt');
    const out = decrypt('cipher-text');
    expect(CryptoJS.AES.decrypt).toHaveBeenCalledWith('cipher-text', 'secret');
    expect(out).toBe('plain-text');
  });
});
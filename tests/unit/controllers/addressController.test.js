jest.mock('../../../models/Address', () => {
  const saveMock = jest.fn(() => Promise.resolve());
  function Address(doc) {
    Object.assign(this, doc);
    this.save = saveMock;
  }
  Address.updateMany = jest.fn();
  Address.findByIdAndUpdate = jest.fn();
  Address.findByIdAndDelete = jest.fn();
  Address.findOne = jest.fn();
  Address.find = jest.fn();
  Address.__saveMock = saveMock;
  return Address;
});

jest.mock('../../../models/User', () => ({
  findByIdAndUpdate: jest.fn(),
}));

const Address = require('../../../models/Address');
const User = require('../../../models/User');
const controller = require('../../../controllers/addressController');
const { mockReqRes } = require('../../helpers/mockReqRes');

describe('addressController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Address.__saveMock.mockResolvedValue(undefined);
  });

  describe('createAddress', () => {
    it('creates address and unsets previous defaults when default=true', async () => {
      Address.updateMany.mockResolvedValue({ acknowledged: true });

      const { req, res } = mockReqRes({
        user: { id: 'u1' },
        body: {
          addressLine1: '123 Main',
          postalCode: '10001',
          default: true,
          deliveryInstructions: 'Leave at door',
          latitude: 1.23,
          longitude: 4.56
        }
      });

      await controller.createAddress(req, res);

      expect(Address.updateMany).toHaveBeenCalledWith({ userId: 'u1' }, { default: false });
      expect(Address.__saveMock).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ status: true, message: 'Address successfully added' });
    });

    it('creates address without changing defaults when default is not true', async () => {
      const { req, res } = mockReqRes({
        user: { id: 'u1' },
        body: {
          addressLine1: '456 Broad',
          postalCode: '20002',
          default: false,
          deliveryInstructions: '',
          latitude: 7.89,
          longitude: 0.12
        }
      });

      await controller.createAddress(req, res);

      expect(Address.updateMany).not.toHaveBeenCalled();
      expect(Address.__saveMock).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('handles save error', async () => {
      Address.__saveMock.mockRejectedValue(new Error('DB error'));

      const { req, res } = mockReqRes({
        user: { id: 'u1' },
        body: { default: false }
      });

      await controller.createAddress(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ status: false, message: 'DB error' });
    });
  });

  describe('setDefaultAddress', () => {
    it('sets specified address as default and updates user.address', async () => {
      Address.updateMany.mockResolvedValue({ acknowledged: true });
      Address.findByIdAndUpdate.mockResolvedValue({ _id: 'a1', default: true });
      User.findByIdAndUpdate.mockResolvedValue({ _id: 'u1' });

      const { req, res } = mockReqRes({
        user: { id: 'u1' },
        params: { address: 'a1' }
      });

      await controller.setDefaultAddress(req, res);

      expect(Address.updateMany).toHaveBeenCalledWith({ userId: 'u1' }, { default: false });
      expect(Address.findByIdAndUpdate).toHaveBeenCalledWith('a1', { default: true }, { new: true });
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u1', { address: 'a1' }, { new: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: true, message: 'Address set as default successfully' });
    });

    it('returns 404 when address not found', async () => {
      Address.updateMany.mockResolvedValue({ acknowledged: true });
      Address.findByIdAndUpdate.mockResolvedValue(null);

      const { req, res } = mockReqRes({
        user: { id: 'u1' },
        params: { address: 'a-missing' }
      });

      await controller.setDefaultAddress(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ status: false, message: 'Address not found' });
    });

    it('handles unexpected error', async () => {
      Address.updateMany.mockRejectedValue(new Error('Boom'));

      const { req, res } = mockReqRes({
        user: { id: 'u1' },
        params: { address: 'a1' }
      });

      await controller.setDefaultAddress(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ status: false, message: 'Boom' });
    });
  });

  describe('deleteAddress', () => {
    it('deletes the address by id', async () => {
      Address.findByIdAndDelete.mockResolvedValue({ _id: 'a1' });

      const { req, res } = mockReqRes({
        params: { id: 'a1' }
      });

      await controller.deleteAddress(req, res);

      expect(Address.findByIdAndDelete).toHaveBeenCalledWith('a1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: true, message: 'Address deleted successfully' });
    });

    it('handles delete error', async () => {
      Address.findByIdAndDelete.mockRejectedValue(new Error('Del error'));

      const { req, res } = mockReqRes({
        params: { id: 'a1' }
      });

      await controller.deleteAddress(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getDefaultAddress', () => {
    it('returns the default address for user', async () => {
      const defaultAddr = { _id: 'a1', default: true };
      Address.findOne.mockResolvedValue(defaultAddr);

      const { req, res } = mockReqRes({
        user: { id: 'u1' }
      });

      await controller.getDefaultAddress(req, res);

      expect(Address.findOne).toHaveBeenCalledWith({ userId: 'u1', default: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(defaultAddr);
    });

    it('handles find error', async () => {
      Address.findOne.mockRejectedValue(new Error('Find error'));

      const { req, res } = mockReqRes({
        user: { id: 'u1' }
      });

      await controller.getDefaultAddress(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getUserAddresses', () => {
    it('returns all addresses for user', async () => {
      const list = [{ _id: 'a1' }, { _id: 'a2' }];
      Address.find.mockResolvedValue(list);

      const { req, res } = mockReqRes({
        user: { id: 'u1' }
      });

      await controller.getUserAddresses(req, res);

      expect(Address.find).toHaveBeenCalledWith({ userId: 'u1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(list);
    });

    it('handles error with structured message', async () => {
      Address.find.mockRejectedValue(new Error('Addr list error'));

      const { req, res } = mockReqRes({
        user: { id: 'u1' }
      });

      await controller.getUserAddresses(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ status: false, message: 'Addr list error' });
    });
  });

  describe('updateAddress', () => {
    it('updates address and clears other defaults when default=true', async () => {
      Address.updateMany.mockResolvedValue({ acknowledged: true });
      Address.findByIdAndUpdate.mockResolvedValue({ _id: 'a1' });

      const { req, res } = mockReqRes({
        params: { id: 'a1' },
        body: {
          userId: 'u1',
          default: true,
          addressLine1: '789 Oak'
        }
      });

      await controller.updateAddress(req, res);

      expect(Address.updateMany).toHaveBeenCalledWith({ userId: 'u1' }, { default: false });
      expect(Address.findByIdAndUpdate).toHaveBeenCalledWith('a1', req.body, { new: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: true, message: 'Address updated successfully' });
    });

    it('updates address without changing defaults when default!=true', async () => {
      Address.findByIdAndUpdate.mockResolvedValue({ _id: 'a1' });

      const { req, res } = mockReqRes({
        params: { id: 'a1' },
        body: {
          userId: 'u1',
          addressLine1: '111 Pine',
          default: false
        }
      });

      await controller.updateAddress(req, res);

      expect(Address.updateMany).not.toHaveBeenCalled();
      expect(Address.findByIdAndUpdate).toHaveBeenCalledWith('a1', req.body, { new: true });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles update error', async () => {
      Address.findByIdAndUpdate.mockRejectedValue(new Error('Upd error'));

      const { req, res } = mockReqRes({
        params: { id: 'a1' },
        body: { userId: 'u1' }
      });

      await controller.updateAddress(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });
  });
});
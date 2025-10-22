const Address = require('../models/Address')
const User = require('../models/User')

module.exports = {
    createAddress: async (req, res) => {

        const address = new Address({
            userId: req.user.id,
            addressLine1: req.body.addressLine1,
            postalCode: req.body.postalCode,
            default: req.body.default,
            deliveryInstructions: req.body.deliveryInstructions,
            latitude: req.body.latitude,
            longitude: req.body.longitude
        });

        try {
            if (req.body.default === true) {
                // Ensure no other address is set as default for this user
                await Address.updateMany({ userId: req.user.id }, { default: false });
            }
            await address.save();
            res.status(201).json({ status: true, message: 'Address successfully added' });
        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },
    setDefaultAddress: async (req, res) => {
        const userId = req.user.id;
        const addressId = req.params.address;

        try {
            // Set all addresses for this user to non-default
            await Address.updateMany({ userId: userId }, { default: false });

            // Now set the specified address as default
            const updatedAddress = await Address.findByIdAndUpdate(addressId, { default: true }, { new: true });

            if (updatedAddress) {
                // Update the user's address field to the new default address
                await User.findByIdAndUpdate(userId, { address: addressId }, { new: true });

                res.status(200).json({ status: true, message: 'Address set as default successfully' });
            } else {
                res.status(404).json({ status: false, message: 'Address not found' });
            }
        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },


    deleteAddress: async (req, res) => {
        const addressId = req.params.id;

        try {
            await Address.findByIdAndDelete(addressId);
            res.status(200).json({ status: true, message: 'Address deleted successfully' });
        } catch (error) {
            res.status(500).json(error);
        }
    },

    getDefaultAddress: async (req, res) => {
        const userId = req.user.id;

        try {
            const defaultAddress = await Address.findOne({ userId, default: true });
            res.status(200).json(defaultAddress);
        } catch (error) {
            res.status(500).json(error);
        }
    },

    getUserAddresses: async (req, res) => {
        const userId = req.user.id;


        try {
            const addresses = await Address.find({ userId });
            res.status(200).json(addresses);
        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },

    updateAddress: async (req, res) => {
        const addressId = req.params.id;


        try {
            if (req.body.default === true) {
                // Ensure no other address is set as default for this user
                await Address.updateMany({ userId: req.body.userId }, { default: false });
            }
            await Address.findByIdAndUpdate(addressId, req.body, { new: true });
            res.status(200).json({ status: true, message: 'Address updated successfully' });
        } catch (error) {
            res.status(500).json(error);
        }
    },




}
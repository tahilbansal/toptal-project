const Order = require("../models/Orders")
const Coupon = require("../models/Coupon");
const { computeOrderTotals } = require("../utils/couponTotalHelper");
const Driver = require("../models/Driver")
const admin = require("firebase-admin");
const { updateDriver, updateRestaurant, updateUser } = require("../utils/driverUpdate")
const sendNotification = require('../utils/sendNotification');
const Restaurant = require("../models/Restaurant");
const User = require("../models/User");
const sendNotificationToTopic = require('../utils/sendToTopic')
const { evaluateStatusChange } = require('../utils/orderStatus')


module.exports = {
    placeOrder: async (req, res) => {

 const tipAmount = Number(req.body.tipAmount || 0);
        const deliveryFee = Number(req.body.deliveryFee || 0);
        const couponCode = req.body.couponCode ? String(req.body.couponCode).toUpperCase().trim() : "";

        try {
            // lookup coupon 
            let couponDoc = null;
            if (couponCode) {
                couponDoc = await Coupon.findOne({ code: couponCode });
            }

            //compute totals on server
            const totals = computeOrderTotals({
                orderItems: req.body.orderItems || [],
                deliveryFee,
                tipAmount,
                couponDoc
            });

            const order = new Order({
                userId: req.body.userId,
                orderItems: req.body.orderItems,
                orderTotal: totals.itemsTotal,
                deliveryFee: deliveryFee,
                grandTotal: totals.grandTotal,
                tipAmount: tipAmount,
                coupon: couponDoc?._id || null,
                couponCode: couponDoc ? couponDoc.code : "",
                discountPercent: totals.discountPercent,
                discountAmount: totals.discountAmount,

                restaurantAddress: req.body.restaurantAddress,
                paymentMethod: req.body.paymentMethod,
                restaurantId: req.body.restaurantId,
                restaurantCoords: req.body.restaurantCoords,
                recipientCoords: req.body.recipientCoords,
                deliveryAddress: req.body.deliveryAddress,
            });

            await order.save();
            const orderId = order.id;
            res.status(201).json({ status: true, message: 'Order placed successfully', orderId: orderId });
        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },

    getOrderDetails: async (req, res) => {
        const orderId = req.params.id;

        try {
            const order = await Order.findById(orderId).select('userId deliveryAddress orderItems deliveryFee tipAmount discountAmount discountPercent couponCode grandTotal restaurantId restaurantCoords recipientCoords orderStatus')
                .populate({
                    path: 'userId',
                    select: 'phone profile'
                })
                .populate({
                    path: 'restaurantId',
                    select: 'title coords imageUrl logoUrl time'
                })
                .populate({
                    path: 'orderItems.foodId',
                    select: 'title imageUrl time'
                })
                .populate({
                    path: 'deliveryAddress',
                    select: 'addressLine1'
                })
                .populate({
                    path: 'driverId',
                    select: 'phone vehicleNumber driver',
                    populate: {
                        path: 'driver',
                        select: 'phone username profile'
                    }
                });

            if (order.status === 'Out_for_Delivery' || order.status === 'Delivered') {
                const driver = await Driver.findById(order.driverId).select('phone vehicleNumber driver')
            }

            if (order) {
                res.status(200).json(order);
            } else {
                res.status(404).json({ status: false, message: 'Order not found' });
            }
        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },

    getUserOrders: async (req, res) => {
        const userId = req.user.id;
        const { paymentStatus, orderStatus } = req.query;

        let query = { userId };

        if (paymentStatus) {
            query.paymentStatus = paymentStatus;
        }

        if (orderStatus) {
            query.orderStatus = orderStatus;
        }

        try {
            const orders = await Order.find(query)
                .populate({
                    path: 'orderItems.foodId',
                    select: 'imageUrl title rating time'
                }).sort({ updatedAt: -1 })
            // .populate('driverId');

            return res.status(200).json(orders);
        } catch (error) {
            res.status(500).json(error);
        }

    },

    deleteOrder: async (req, res) => {
        const { orderId } = req.params;

        try {
            await Order.findByIdAndDelete(orderId);
            res.status(200).json({ status: true, message: 'Order deleted successfully' });
        } catch (error) {
            res.status(500).json(error);
        }
    },



    rateOrder: async (req, res) => {
        const orderId = req.params.id;
        const { rating, feedback } = req.body;

        try {
            const updatedOrder = await Order.findByIdAndUpdate(orderId, { rating, feedback }, { new: true });
            if (updatedOrder) {
                res.status(200).json({ status: true, message: 'Rating and feedback added successfully', data: updatedOrder });
            } else {
                res.status(404).json({ status: false, message: 'Order not found' });
            }
        } catch (error) {
            res.status(500).json(error);
        }
    },

    updateOrderStatus: async (req, res) => {
    const orderId = req.params.id;
    const requested = req.body.orderStatus;
    const userId = req.user.id;
    const userType = req.user.userType; // 'Customer' | 'Restaurant Owner'

    try {
        const order = await Order.findById(orderId);
        if (!order) {
        return res.status(404).json({ status: false, message: 'Order not found' });
        }

        // Verify actor identity (customer must own the order)
        const isCustomer = String(order.userId) === String(userId) && userType === 'Customer';
        const isRestaurantOwner = userType === 'Restaurant Owner';
        if (!isCustomer && !isRestaurantOwner) {
        return res.status(403).json({ status: false, message: 'You are not allowed to update this order.' });
        }

        const decision = evaluateStatusChange({
        current: order.orderStatus,
        requested,
        role: isCustomer ? 'Customer' : 'Restaurant Owner',
        });

        if (!decision.ok) {
        return res.status(decision.http).json({ status: false, message: decision.message });
        }

        // Optional: record customer acknowledgement when "Received"
        if (requested && String(requested).toLowerCase().includes('received')) {
        // e.g., order.customerReceivedAt = new Date();
        // Not changing orderStatus since schema has no "Received"
        }

        if (!decision.persistChange) {
        return res.status(200).json({ status: true, message: decision.message, data: order });
        }

        order.orderStatus = decision.next;
        await order.save();
        return res.status(200).json({ status: true, message: 'Order status updated successfully', data: order });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
},


    updatePaymentStatus: async (req, res) => {
        const orderId = req.params.id;


        try {
            const updatedOrder = await Order.findByIdAndUpdate(orderId, { paymentStatus: 'Completed' }, { new: true }).select('userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus')
                .populate({
                    path: 'userId',
                    select: 'phone profile'
                })
                .populate({
                    path: 'restaurantId',
                    select: 'title coords imageUrl logoUrl time' 
                })
                .populate({
                    path: 'orderItems.foodId',
                    select: 'title imageUrl time' 
                })
                .populate({
                    path: 'deliveryAddress',
                    select: 'addressLine1 city district' 
                });
            if (updatedOrder) {
                res.status(200).json({ status: true, message: 'Payment status updated successfully', data: updatedOrder });
            } else {
                res.status(404).json({ status: false, message: 'Order not found' });
            }
        } catch (error) {
            res.status(500).json(error);
        }
    },

    getRestaurantOrders: async (req, res) => {

        let status
        if (req.query.status === 'placed') {
            status = "Placed"
        } else if (req.query.status === 'preparing') {
            status = "Preparing"
        } else if (req.query.status === 'ready') {
            status = "Ready"
        } else if (req.query.status === 'out_for_delivery') {
            status = "Out_for_Delivery"
        } else if (req.query.status === 'delivered') {
            status = "Delivered"
        } else if (req.query.status === 'manual') {
            status = "Manual"
        } else if (req.query.status === 'cancelled') {
            status = "Cancelled"
        }
        try {
            const parcels = await Order.find({
                orderStatus: status, restaurantId: req.params.id, paymentStatus: 'Completed'
            }).select('userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus')
                .populate({
                    path: 'userId',
                    select: 'phone profile'
                })
                .populate({
                    path: 'restaurantId',
                    select: 'title coords imageUrl logoUrl time'
                })
                .populate({
                    path: 'orderItems.foodId',
                    select: 'title imageUrl time'
                })


            res.status(200).json(parcels);
        } catch (error) {
            res.status(500).json({ status: false, message: 'Error retrieving parcels', error: error.message });
        }
    },

    getRestaurantOrdersList: async (req, res) => {
        let status
        if (req.query.status === 'placed') {
            status = "Placed"
        } else if (req.query.status === 'preparing') {
            status = "Preparing"
        } else if (req.query.status === 'ready') {
            status = "Ready"
        } else if (req.query.status === 'out_for_delivery') {
            status = "Out_for_Delivery"
        } else if (req.query.status === 'delivered') {
            status = "Delivered"
        } else if (req.query.status === 'manual') {
            status = "Manual"
        } else if (req.query.status === 'cancelled') {
            status = "Cancelled"
        }
        try {
            const parcels = await Order.find({
                orderStatus: status, restaurantId: req.params.id, paymentStatus: 'Completed'
            }).select('userId deliveryAddress orderItems deliveryFee restaurantId orderStatus restaurantCoords recipientCoords')
                .populate({
                    path: 'userId',
                    select: 'phone profile' 
                }).populate({
                    path: 'restaurantId',
                    select: 'title imageUrl logoUrl time' 
                })
                .populate({
                    path: 'orderItems.foodId',
                    select: 'title imageUrl time' 
                }).populate({
                    path: 'deliveryAddress',
                    select: 'addressLine1'
                })


            res.status(200).json(parcels);
        } catch (error) {
            res.status(500).json({ status: false, message: 'Error retrieving parcels', error: error.message });
        }
    },

    getNearbyOrders: async (req, res) => {
        try {
            const parcels = await Order.find({
                orderStatus: req.params.status, paymentStatus: 'Completed'
            }).select('userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus')
                .populate({
                    path: 'userId',
                    select: 'phone profile' 
                })
                .populate({
                    path: 'restaurantId',
                    select: 'title coords imageUrl logoUrl time'
                })
                .populate({
                    path: 'orderItems.foodId',
                    select: 'title imageUrl time' 
                })
                .populate({
                    path: 'deliveryAddress',
                    select: 'addressLine1 city district'
                })



            res.status(200).json(parcels);
        } catch (error) {
            res.status(500).json({ status: false, message: 'Error retrieving parcels', error: error.message });
        }
    },

    getPickedOrders: async (req, res) => {

        let status
        if (req.params.status === 'Out_for_Delivery') {
            status = "Out_for_Delivery"
        } else if (req.params.status === 'Delivered') {
            status = "Delivered"
        } else if (req.params.status === 'Manual') {
            status = "Manual"
        } else {
            status = "Cancelled"
        }
        try {
            const parcels = await Order.find({
                orderStatus: status, driverId: req.params.driver
            }).select('userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus')
                .populate({
                    path: 'userId',
                    select: 'phone profile'
                })
                .populate({
                    path: 'restaurantId',
                    select: 'title coords imageUrl logoUrl time' 
                })
                .populate({
                    path: 'orderItems.foodId',
                    select: 'title imageUrl time'
                })
                .populate({
                    path: 'deliveryAddress',
                    select: 'addressLine1'
                })

            res.status(200).json(parcels);
        } catch (error) {
            res.status(500).json({ status: false, message: 'Error retrieving parcels', error: error.message });
        }
    },

    addDriver: async (req, res) => {
        const orderId = req.params.id;
        const driver = req.params.driver;
        const status = 'Out_for_Delivery';

        try {
            const updatedOrder = await Order.findByIdAndUpdate(orderId, { orderStatus: 'Out_for_Delivery', driverId: driver }, { new: true }).select('userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus')
                .populate({
                    path: 'userId',
                    select: 'phone profile fcm' 
                })
                .populate({
                    path: 'restaurantId',
                    select: 'title coords imageUrl logoUrl time'
                })
                .populate({
                    path: 'orderItems.foodId',
                    select: 'title imageUrl time'
                })
                .populate({
                    path: 'deliveryAddress',
                    select: 'addressLine1 city district'
                });

            const user = await User.findById(updatedOrder.userId._id, { fcm: 1 })

            if (updatedOrder) {
                const data = {
                    orderId: updatedOrder._id.toString(),
                    messageType: 'order'
                };
                const db = admin.database()

                if (user.fcm || user.fcm !== null || user.fcm !== '') {
                    sendNotification(user.fcm, "🚚 Order Picked Up and Out for Delivery", data, `Your order has been picked up and now getting delivered.`)
                }

                updateUser(updatedOrder, db, status);
                res.status(200).json(updatedOrder);
            } else {
                res.status(404).json({ status: false, message: 'Order not found' });
            }
        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },

    markAsDelivered: async (req, res) => {
        const orderId = req.params.id;
        const status = 'Delivered';
        const userId = req.user.id;

        try {

            const updatedOrder = await Order.findByIdAndUpdate(orderId, { orderStatus: 'Delivered' }, { new: true }).select('userId orderTotal deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus')
                .populate({
                    path: 'userId',
                    select: 'phone profile fcm' 
                })
                .populate({
                    path: 'restaurantId',
                    select: 'title coords imageUrl logoUrl time'
                })
                .populate({
                    path: 'orderItems.foodId',
                    select: 'title imageUrl time' 
                })
                .populate({
                    path: 'deliveryAddress',
                    select: 'addressLine1'
                });



            await Restaurant.findByIdAndUpdate(updatedOrder.restaurantId._id, {
                $inc: { earnings: updatedOrder.orderTotal }
            }, { new: true });

            const driver = await Driver.findOne({ driver: userId });

            if (updatedOrder) {
                const data = {
                    orderId: updatedOrder._id.toString(),
                    messageType: 'order'
                };
                const db = admin.database()
                updateRestaurant(updatedOrder, db, status);
                updateUser(updatedOrder, db, status);

                const user = await User.findById(updatedOrder.userId._id, { fcm: 1 })

                if (user.fcm || user.fcm !== null || user.fcm !== '') {
                    sendNotification(user.fcm, "🎊 Food Delivered 🎉", data, `Thank you for ordering from us! Your order has been successfully delivered.`)
                }

                if (driver) {
                    driver.totalDeliveries = +1;
                    driver.totalEarnings = driver.totalEarnings + updatedOrder.deliveryFee;
                }

                await driver.save()

                res.status(200).json(updatedOrder);
            } else {
                res.status(404).json({ status: false, message: 'Order not found' });
            }
        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },

    processOrder: async (req, res) => {
        const orderId = req.params.id;
        const status = req.params.status;

        try {
            const updatedOrder = await Order.findByIdAndUpdate(orderId, { orderStatus: status }, { new: true }).select('userId deliveryAddress orderItems deliveryFee restaurantId restaurantCoords recipientCoords orderStatus')
                .populate({
                    path: 'userId',
                    select: 'phone profile'
                })
                .populate({
                    path: 'restaurantId',
                    select: 'title coords imageUrl logoUrl time' 
                })
                .populate({
                    path: 'orderItems.foodId',
                    select: 'title imageUrl time'
                })
                .populate({
                    path: 'deliveryAddress',
                    select: 'addressLine1 city district'
                });

            const user = await User.findById(updatedOrder.userId._id, { fcm: 1 })

            if (user) {
                if (updatedOrder) {

                    const data = {
                        orderId: updatedOrder._id.toString(),
                        messageType: 'order'
                    };

                    if (status === 'Preparing') {
                        if (user.fcm || user.fcm !== null || user.fcm !== '') {
                            sendNotification(user.fcm, "👩‍🍳 Order Accepted and Preparing", data, `Your order is being prepared and will be ready soon`)
                        }
                    } else if (status === 'Ready') {
                        if (user.fcm || user.fcm !== null || user.fcm !== '') {
                            sendNotificationToTopic(data);
                            sendNotification(user.fcm, "🚚 Order Awaits Pick Up", data, `Your order prepared and is waiting to be picked up`)

                        }
                    } else if (status === 'Out_for_Delivery' || status === 'Manual') {
                        if (user.fcm || user.fcm !== null || user.fcm !== '') {
                            sendNotification(user.fcm, "🚚 Order Picked Up and Out for Delivery", data, `Your order has been picked up and now getting delivered.`)
                        }
                    } else if (status === 'Delivered') {

                        await Restaurant.findByIdAndUpdate(updatedOrder.restaurantId._id, {
                            $inc: { earnings: updatedOrder.orderTotal }
                        }, { new: true });

                        if (user.fcm || user.fcm !== null || user.fcm !== '') {
                            sendNotification(user.fcm, "🎊 Food Delivered 🎉", data, `Thank you for ordering from us! Your order has been successfully delivered.`)
                        }
                    } else if (status === 'Cancelled') {
                        if (user.fcm || user.fcm !== null || user.fcm !== '') {
                            sendNotification(user.fcm, `💔 Order Cancelled`, data, `Your order has been cancelled. Contact the restaurant for more information`)
                        }
                    }


                    res.status(200).json(updatedOrder);
                } else {
                    res.status(404).json({ status: false, message: 'Order not found' });
                }
            }

        } catch (error) {
            res.status(500).json({ status: false, message: error.message });
        }
    },

}





function updateDriver(updatedOrder, db) {
    let ref = db.ref("drivers");

    const data = {
        order_id: updatedOrder.id,
    };
    try {
        ref.set(data)
    } catch (error) {
        console.log(error);
    }

}

function updateRestaurant(updatedOrder, db, status) {
    const id = updatedOrder.restaurantId._id.toString();

    let ref = db.ref(id);

    const restaurant = {
        update_type: "restaurant",
        order_id: updatedOrder.id,
        status: status
    };

    try {
        ref.set(restaurant)

    } catch (error) {
        console.error('Error updating restaurant:', error);
    }
}

function updateUser(updatedOrder, db, status) {
    const id = updatedOrder.userId._id.toString();

    let ref = db.ref(id);

    const user = {
        order_id: updatedOrder.id,
        status: status
    }

    try {
        ref.set(user)

    } catch (error) {
        console.error('Error updating user:', error);
    }
};

module.exports = { updateDriver, updateRestaurant, updateUser }
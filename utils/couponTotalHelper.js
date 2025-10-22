function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function sumItems(orderItems = []) {
  return round2(orderItems.reduce((acc, it) => {
    const line = Number(it.price || 0) * Number(it.quantity || 0);
    return acc + line;
  }, 0));
}

function computeOrderTotals({ orderItems, deliveryFee = 0, tipAmount = 0, couponDoc = null }) {
  const itemsTotal = sumItems(orderItems);
  const validCoupon =
    couponDoc &&
    couponDoc.active &&
    (!couponDoc.expiresAt || new Date(couponDoc.expiresAt) > new Date()) &&
    couponDoc.percentOff > 0;

  const percent = validCoupon ? Number(couponDoc.percentOff) : 0;
  let discountAmount = round2((percent / 100) * itemsTotal);
  if (validCoupon && couponDoc.maxDiscount > 0) {
    discountAmount = Math.min(discountAmount, Number(couponDoc.maxDiscount));
  }

  const subtotal = round2(itemsTotal - discountAmount);
  const grandTotal = round2(subtotal + Number(deliveryFee || 0) + Number(tipAmount || 0));

  return {
    itemsTotal: round2(itemsTotal),
    discountPercent: percent,
    discountAmount: round2(discountAmount),
    grandTotal
  };
}

module.exports = { computeOrderTotals };
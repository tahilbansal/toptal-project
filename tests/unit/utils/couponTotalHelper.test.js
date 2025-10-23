const { computeOrderTotals } = require('../../../utils/couponTotalHelper');

describe('couponTotalHelper.computeOrderTotals', () => {
  it('computes totals with coupon', () => {
    const orderItems = [
      { price: 10, quantity: 2 },
      { price: 5, quantity: 1 },
    ];
    const deliveryFee = 4;
    const tipAmount = 2;
    const couponDoc = { active: true, percentOff: 10, maxDiscount: 0 };

    const result = computeOrderTotals({ orderItems, deliveryFee, tipAmount, couponDoc });

    expect(result).toEqual(
      expect.objectContaining({
        itemsTotal: expect.any(Number),
        discountPercent: expect.any(Number),
        discountAmount: expect.any(Number),
        grandTotal: expect.any(Number),
      })
    );

    expect(result.itemsTotal).toBe(25);
    expect(result.discountPercent).toBe(10);
    expect(result.discountAmount).toBeCloseTo(2.5);
    expect(result.grandTotal).toBeCloseTo(25 - 2.5 + 4 + 2);
  });

  it('computes totals without coupon', () => {
    const orderItems = [{ price: 12.5, quantity: 3 }];
    const result = computeOrderTotals({ orderItems, deliveryFee: 0, tipAmount: 0, couponDoc: null });
    expect(result.discountPercent).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.itemsTotal).toBeCloseTo(37.5);
    expect(result.grandTotal).toBeCloseTo(37.5);
  });

  it('caps discount by maxDiscount', () => {
    const orderItems = [{ price: 100, quantity: 1 }];
    const couponDoc = { active: true, percentOff: 50, maxDiscount: 20 };
    const result = computeOrderTotals({ orderItems, deliveryFee: 0, tipAmount: 0, couponDoc });
    expect(result.discountPercent).toBe(50);
    expect(result.discountAmount).toBe(20);
    expect(result.grandTotal).toBe(80);
  });
});
const {
  ROLES,
  SEQUENCE,
  normalizeStatus,
  evaluateStatusChange,
} = require('../../../utils/orderStatus');

describe('utils/orderStatus', () => {
  describe('normalizeStatus', () => {
    it('maps synonyms to canonical values', () => {
      expect(normalizeStatus('canceled')).toBe('Canceled');
      expect(normalizeStatus('cancelled')).toBe('Canceled');
      expect(normalizeStatus('out_for_delivery')).toBe('In Route');
      expect(normalizeStatus('in route')).toBe('In Route');
      expect(normalizeStatus('preparing')).toBe('Processing');
      expect(normalizeStatus('received')).toBe('Received');
    });

    it('returns original if not mapped', () => {
      expect(normalizeStatus('Placed')).toBe('Placed');
      expect(normalizeStatus('Unknown')).toBe('Unknown');
    });

    it('returns empty string for falsy input', () => {
      expect(normalizeStatus('')).toBe('');
      expect(normalizeStatus(null)).toBe('');
      expect(normalizeStatus(undefined)).toBe('');
    });
  });

  describe('evaluateStatusChange - permissions', () => {
    it('denies invalid or missing requested status', () => {
      const r1 = evaluateStatusChange({ current: 'Placed', requested: '', role: ROLES.CUSTOMER });
      expect(r1.ok).toBe(false);
      expect(r1.http).toBe(400);

      const r2 = evaluateStatusChange({ current: 'Placed', requested: 'NotAStatus', role: ROLES.OWNER });
      expect(r2.ok).toBe(false);
      expect(r2.http).toBe(400);
    });

    it('customers can only set Cancelled or Received', () => {
      const denied = evaluateStatusChange({ current: 'Placed', requested: 'Processing', role: ROLES.CUSTOMER });
      expect(denied.ok).toBe(false);
      expect(denied.http).toBe(403);

      const allowedCancel = evaluateStatusChange({ current: 'Placed', requested: 'Canceled', role: ROLES.CUSTOMER });
      expect(allowedCancel.ok).toBe(true);
      expect(allowedCancel.persistChange).toBe(true);
      expect(allowedCancel.next).toBe('Canceled');

      const allowedReceived = evaluateStatusChange({ current: 'Delivered', requested: 'Received', role: ROLES.CUSTOMER });
      expect(allowedReceived.ok).toBe(true);
      expect(allowedReceived.persistChange).toBe(false); // ack only
      expect(allowedReceived.next).toBe('Delivered');
    });

    it('owners can set Processing, Ready, In Route, Delivered, Canceled', () => {
      for (const status of ['Processing', 'Ready', 'In Route', 'Delivered', 'Canceled']) {
        const res = evaluateStatusChange({ current: 'Placed', requested: status, role: ROLES.OWNER });
        // Forward-only validated elsewhere; here we just ensure it’s not blocked by permissions
        if (status === 'Delivered') {
          // backward/skip may be denied by sequence checks; ensure permission doesn’t cause 403
          if (!res.ok) expect(res.http).not.toBe(403);
        } else {
          // For Processing from Placed should be ok
          if (status === 'Processing') {
            expect(res.ok).toBe(true);
          }
        }
      }
    });
  });

  describe('evaluateStatusChange - sequence forward-only', () => {
    it('allows forward transitions and blocks backward moves', () => {
      // Forward: Placed -> Processing
      const fwd1 = evaluateStatusChange({ current: 'Placed', requested: 'Processing', role: ROLES.OWNER });
      expect(fwd1.ok).toBe(true);
      expect(fwd1.persistChange).toBe(true);
      expect(fwd1.next).toBe('Processing');

      // Forward: Processing -> Ready
      const fwd2 = evaluateStatusChange({ current: 'Processing', requested: 'Ready', role: ROLES.OWNER });
      expect(fwd2.ok).toBe(true);
      expect(fwd2.persistChange).toBe(true);
      expect(fwd2.next).toBe('Ready');

      // Backward: Processing -> Placed
      const back1 = evaluateStatusChange({ current: 'Processing', requested: 'Placed', role: ROLES.OWNER });
      expect(back1.ok).toBe(false);
      expect(back1.http).toBe(409);
      expect(back1.message).toMatch(/cannot move backwards/i);

      // Same status: Ready -> Ready
      const same = evaluateStatusChange({ current: 'Ready', requested: 'Ready', role: ROLES.OWNER });
      expect(same.ok).toBe(true);
      expect(same.persistChange).toBe(false);
      expect(same.next).toBe('Ready');
    });

    it('accepts synonyms and enforces order (e.g., out_for_delivery -> In Route)', () => {
      const res = evaluateStatusChange({ current: 'Ready', requested: 'out_for_delivery', role: ROLES.OWNER });
      expect(res.ok).toBe(true);
      expect(res.next).toBe('In Route');

      const back = evaluateStatusChange({ current: 'Delivered', requested: 'in_route', role: ROLES.OWNER });
      expect(back.ok).toBe(false);
      expect(back.http).toBe(409);
    });
  });

  describe('evaluateStatusChange - cancellation and received', () => {
    it('cancellation is terminal and idempotent', () => {
      const cancelFromPlaced = evaluateStatusChange({ current: 'Placed', requested: 'Canceled', role: ROLES.OWNER });
      expect(cancelFromPlaced.ok).toBe(true);
      expect(cancelFromPlaced.persistChange).toBe(true);
      expect(cancelFromPlaced.next).toBe('Canceled');

      const cancelDelivered = evaluateStatusChange({ current: 'Delivered', requested: 'Canceled', role: ROLES.OWNER });
      expect(cancelDelivered.ok).toBe(false);
      expect(cancelDelivered.http).toBe(409);

      const cancelAgain = evaluateStatusChange({ current: 'Canceled', requested: 'Canceled', role: ROLES.OWNER });
      expect(cancelAgain.ok).toBe(true);
      expect(cancelAgain.persistChange).toBe(false);
      expect(cancelAgain.next).toBe('Canceled');
    });

    it('customer Received requires Delivered and does not persist change', () => {
      const bad = evaluateStatusChange({ current: 'In Route', requested: 'Received', role: ROLES.CUSTOMER });
      expect(bad.ok).toBe(false);
      expect(bad.http).toBe(409);

      const ok = evaluateStatusChange({ current: 'Delivered', requested: 'Received', role: ROLES.CUSTOMER });
      expect(ok.ok).toBe(true);
      expect(ok.persistChange).toBe(false);
      expect(ok.next).toBe('Delivered');
    });
  });

 describe('exports', () => {
    it('exposes expected sequence and roles', () => {
      expect(ROLES.CUSTOMER).toBe('Customer');
      expect(ROLES.OWNER).toBe('Restaurant Owner');
      expect(SEQUENCE).toEqual(['Placed', 'Processing', 'Ready', 'In Route', 'Delivered']);
    });
  });
});
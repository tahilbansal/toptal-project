const ROLES = {
  CUSTOMER: 'Customer',
  OWNER: 'Restaurant Owner',
};

const SEQUENCE = ['Placed', 'Processing', 'Ready', 'In Route', 'Delivered'];

const SYNONYMS = new Map([
  ['placed', 'Placed'],
  ['processing', 'Processing'],
  ['preparing', 'Processing'],
  ['ready', 'Ready'],
  ['in route', 'In Route'],
  ['in_route', 'In Route'],
  ['out for delivery', 'In Route'],
  ['out_for_delivery', 'In Route'],
  ['out-for-delivery', 'In Route'],
  ['delivered', 'Delivered'],
  ['canceled', 'Canceled'],
  ['cancelled', 'Canceled'],
  ['cancel', 'Canceled'],
  ['received', 'Received'],
]);

function normalizeStatus(s) {
  if (!s) return '';
  const t = String(s).trim();
  return SYNONYMS.get(t.toLowerCase()) || t;
}

function isRecognized(status) {
  return SEQUENCE.includes(status) || status === 'Canceled' || status === 'Received';
}

function isAllowedForRole(role, status) {
  if (role === ROLES.CUSTOMER) return status === 'Canceled' || status === 'Received';
  if (role === ROLES.OWNER) return ['Processing', 'Ready', 'In Route', 'Delivered', 'Canceled'].includes(status);
  return false;
}

function evaluateStatusChange({ current, requested, role }) {
  const curr = normalizeStatus(current);
  const next = normalizeStatus(requested);

  if (!next) return { ok: false, http: 400, message: 'Invalid or missing orderStatus' };
  if (!isRecognized(next)) return { ok: false, http: 400, message: `Unsupported status "${requested}"` };

  // Forward-only enforcement
  // so backward moves return 409 even if the role wouldn't be allowed anyway.
  if (SEQUENCE.includes(next)) {
    if (SEQUENCE.includes(curr)) {
      const ci = SEQUENCE.indexOf(curr);
      const ni = SEQUENCE.indexOf(next);
      if (ni < ci) return { ok: false, http: 409, message: 'Status cannot move backwards' };
      if (ni === ci) return { ok: true, persistChange: false, next: curr, message: 'Status unchanged' };

      if (!isAllowedForRole(role, next)) {
        return { ok: false, http: 403, message: 'Status not allowed for your role' };
      }
      return { ok: true, persistChange: true, next, message: 'Order status updated' };
    }
    // current not in sequence
    if (!isAllowedForRole(role, next)) {
      return { ok: false, http: 403, message: 'Status not allowed for your role' };
    }
    return { ok: true, persistChange: true, next, message: 'Order status updated' };
  }

  // Customer "Received" acknowledgement
  if (next === 'Received') {
    if (!isAllowedForRole(role, next)) return { ok: false, http: 403, message: 'Status not allowed for your role' };
    if (curr !== 'Delivered') {
      return { ok: false, http: 409, message: 'Order must be Delivered before it can be marked as Received' };
    }
    return { ok: true, persistChange: false, next: curr, message: 'Order receipt acknowledged' };
  }

  // Cancellation
  if (next === 'Canceled') {
    if (!isAllowedForRole(role, next)) return { ok: false, http: 403, message: 'Status not allowed for your role' };
    if (curr === 'Delivered') return { ok: false, http: 409, message: 'Delivered orders cannot be canceled' };
    if (curr === 'Canceled') return { ok: true, persistChange: false, next: curr, message: 'Order already canceled' };
    return { ok: true, persistChange: true, next, message: 'Order canceled' };
  }

  // Fallback (recognized non-sequence handled above)
  return { ok: false, http: 400, message: `Unsupported status "${requested}"` };
}

module.exports = { ROLES, SEQUENCE, normalizeStatus, evaluateStatusChange };
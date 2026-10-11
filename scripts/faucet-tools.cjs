function isValidAddress(value) {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function createRateLimiter({ maxRequests, windowMs, now = Date.now }) {
  const buckets = new Map();
  return {
    allow(key) {
      const current = now();
      const recent = (buckets.get(key) || []).filter(timestamp => current - timestamp < windowMs);
      if (recent.length >= maxRequests) {
        buckets.set(key, recent);
        return false;
      }
      recent.push(current);
      buckets.set(key, recent);
      return true;
    },
  };
}

module.exports = { isValidAddress, createRateLimiter };

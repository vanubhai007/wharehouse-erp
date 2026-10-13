const { nextSequence } = require('../models/Counter');

function pad(num, size) {
  return String(num).padStart(size, '0');
}

async function generateId(prefix, key, padSize = 5) {
  const seq = await nextSequence(key);
  return `${prefix}${pad(seq, padSize)}`;
}

// e.g. generateCustomerId() -> "CUST-00001"
const generateCustomerId = () => generateId('CUST-', 'customer');
const generateOwnerId = () => generateId('OWN-', 'owner');
const generateBuyerId = () => generateId('BUY-', 'buyer');
const generateItemId = () => generateId('ITM-', 'item');

async function generateYearlyId(prefix, key) {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`${key}:${year}`);
  return `${prefix}${year}-${pad(seq, 5)}`;
}

module.exports = {
  generateId,
  generateYearlyId,
  generateCustomerId,
  generateOwnerId,
  generateBuyerId,
  generateItemId,
};

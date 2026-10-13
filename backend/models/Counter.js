const mongoose = require('mongoose');

// Generic atomic sequence counter used to generate human-readable,
// collision-free IDs (customer IDs, item IDs, invoice numbers, etc.)
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // sequence key, e.g. "customer", "invoice:2026"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

async function nextSequence(key) {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

module.exports = { Counter, nextSequence };

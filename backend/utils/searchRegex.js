// Search text typed by users is matched literally - case-insensitive, anywhere
// in the field. Regex metacharacters are escaped, so "C++", "+91" or "(Pvt)"
// search for those characters instead of being read as a pattern.
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchRegex = (text) => new RegExp(escapeRegex(text), 'i');

module.exports = { escapeRegex, searchRegex };

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Runs after an express-validator chain; converts failures into a 400 ApiError.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest(
      'Validation failed',
      errors.array().map((e) => ({ field: e.path, message: e.msg }))
    );
  }
  next();
}

module.exports = validate;

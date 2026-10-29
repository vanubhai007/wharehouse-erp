import jwt from 'jsonwebtoken';

export function generateToken(admin) {
  return jwt.sign({ sub: admin._id.toString(), email: admin.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

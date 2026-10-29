import Admin from '../models/Admin.js';
import { generateToken } from '../utils/generateToken.js';

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
  if (!admin) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const valid = await admin.comparePassword(password);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = generateToken(admin);
  res.json({ token, admin: { id: admin._id, email: admin.email, name: admin.name } });
}

export async function me(req, res) {
  const admin = await Admin.findById(req.admin.sub).select('-passwordHash');
  if (!admin) {
    return res.status(404).json({ message: 'Admin not found' });
  }
  res.json({ admin });
}

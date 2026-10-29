import Message from '../models/Message.js';

export async function createMessage(req, res) {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: 'name, email and message are all required' });
  }

  const saved = await Message.create({ name, email, message });
  res.status(201).json({ id: saved._id, createdAt: saved.createdAt });
}

export async function listMessages(req, res) {
  const messages = await Message.find().sort({ createdAt: -1 }).limit(100);
  res.json({ messages });
}

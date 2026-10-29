import { Router } from 'express';
import { login, me } from '../controllers/authController.js';
import { requireAdminAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', requireAdminAuth, me);

export default router;

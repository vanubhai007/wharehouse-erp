import { Router } from 'express';
import { createMessage, listMessages } from '../controllers/contactController.js';
import { requireAdminAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', createMessage);
router.get('/', requireAdminAuth, listMessages);

export default router;

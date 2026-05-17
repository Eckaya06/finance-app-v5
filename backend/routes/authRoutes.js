import express from 'express';
import {
  signup,
  login,
  me,
  logout,
  changeEmail,
  changePassword,
  changeDisplayName,
  deleteAccount,
  verifyEmail,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.post('/signup', signup);
router.post('/login', login);
router.get('/me', protect, me);
router.post('/logout', protect, logout);
router.put('/change-email', protect, changeEmail);
router.put('/change-password', protect, changePassword);
router.put('/change-display-name', protect, changeDisplayName);
router.delete('/account', protect, deleteAccount);
router.get('/verify/:token', verifyEmail);

export default router;

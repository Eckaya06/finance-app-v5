import express from 'express';
import { getAiAnswer } from '../controllers/aiController.js';

const router = express.Router();
router.post('/', getAiAnswer);

export default router;

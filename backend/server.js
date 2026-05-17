import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import potRoutes from './routes/potRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import recurringBillRoutes from './routes/recurringBillRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import diagnosticsRoutes from './routes/diagnosticsRoutes.js';
import { startBillReminderJob } from './jobs/billReminderJob.js';

dotenv.config();
connectDB();
startBillReminderJob();

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/pots', potRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/bills', recurringBillRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Finance backend listening on port ${PORT}`);
});

// Trigger restart for env

import express from 'express';
import { adminProtect } from '../middleware/adminMiddleware.js';
import {
  getDashboardStats,
  getCollections,
  getCollectionDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  bulkDeleteDocuments,
  createDocument,
  rawQuery,
} from '../controllers/adminController.js';

const router = express.Router();

// Tüm admin route'ları adminProtect middleware ile korunur
router.use(adminProtect);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Koleksiyonlar
router.get('/collections', getCollections);
router.get('/collections/:collection', getCollectionDocuments);

// Dökümanlar
router.get('/collections/:collection/:id', getDocument);
router.put('/collections/:collection/:id', updateDocument);
router.delete('/collections/:collection/:id', deleteDocument);

// Toplu işlemler
router.post('/collections/:collection/bulk-delete', bulkDeleteDocuments);
router.post('/collections/:collection/create', createDocument);

// Raw query (ileri düzey)
router.post('/collections/:collection/query', rawQuery);

export default router;

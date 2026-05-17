/**
 * Admin Controller
 * 
 * Tüm veritabanı koleksiyonlarına tam erişim sağlar:
 * - Koleksiyon listesi & istatistikleri
 * - Koleksiyon içeriğini listeleme (sayfalama, arama, sıralama)
 * - Tek döküman görüntüleme
 * - Döküman güncelleme
 * - Döküman silme
 * - Toplu silme
 * - Yeni döküman oluşturma
 * - Genel istatistikler (dashboard)
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import Pot from '../models/Pot.js';
import RecurringBill from '../models/RecurringBill.js';
import Portfolio from '../models/Portfolio.js';

// Model haritası
const MODELS = {
  users: User,
  transactions: Transaction,
  budgets: Budget,
  pots: Pot,
  recurringbills: RecurringBill,
  portfolios: Portfolio,
};

// Model meta bilgileri (frontend'e label/icon vs. için)
const MODEL_META = {
  users: { label: 'Users', icon: 'users', color: '#6366f1' },
  transactions: { label: 'Transactions', icon: 'transactions', color: '#10b981' },
  budgets: { label: 'Budgets', icon: 'budgets', color: '#f59e0b' },
  pots: { label: 'Pots', icon: 'pots', color: '#8b5cf6' },
  recurringbills: { label: 'Recurring Bills', icon: 'bills', color: '#ef4444' },
  portfolios: { label: 'Portfolios', icon: 'portfolios', color: '#3b82f6' },
};

// ─── Dashboard İstatistikleri ────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const stats = {};
    
    for (const [key, Model] of Object.entries(MODELS)) {
      const count = await Model.countDocuments();
      stats[key] = {
        ...MODEL_META[key],
        count,
      };
    }

    // Son kullanıcılar
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('email displayName createdAt isVerified');

    // Son işlemler
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'email displayName');

    // DB bağlantı durumu
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const dbName = mongoose.connection.db?.databaseName || 'unknown';
    const dbHost = mongoose.connection.host || 'unknown';

    res.json({
      stats,
      recentUsers,
      recentTransactions,
      database: { status: dbStatus, name: dbName, host: dbHost },
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Koleksiyon Listesi ──────────────────────────────────────────────
export const getCollections = async (req, res) => {
  try {
    const collections = [];
    for (const [key, Model] of Object.entries(MODELS)) {
      const count = await Model.countDocuments();
      collections.push({
        key,
        ...MODEL_META[key],
        count,
      });
    }
    res.json({ collections });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Koleksiyon İçeriği (Sayfalama + Arama + Sıralama) ──────────────
export const getCollectionDocuments = async (req, res) => {
  try {
    const { collection } = req.params;
    const Model = MODELS[collection];
    if (!Model) {
      return res.status(404).json({ message: `Collection "${collection}" not found.` });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = req.query.search || '';

    let filter = {};
    if (search) {
      // Tüm string alanlarında arama
      const schema = Model.schema;
      const searchableFields = [];
      schema.eachPath((path, schemaType) => {
        if (schemaType.instance === 'String') {
          searchableFields.push(path);
        }
      });
      if (searchableFields.length > 0) {
        filter = {
          $or: searchableFields.map(field => ({
            [field]: { $regex: search, $options: 'i' }
          }))
        };
      }
    }

    const total = await Model.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    let query = Model.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    // userId alanı varsa populate et
    const schema = Model.schema;
    if (schema.path('userId')) {
      query = query.populate('userId', 'email displayName');
    }

    const documents = await query;

    // Şema alanlarını al (frontend tablo başlıkları için)
    const fields = [];
    schema.eachPath((path, schemaType) => {
      if (path === '__v') return;
      fields.push({
        name: path,
        type: schemaType.instance || 'Mixed',
        required: !!schemaType.isRequired,
        enum: schemaType.enumValues || null,
      });
    });

    res.json({
      collection,
      meta: MODEL_META[collection],
      documents,
      fields,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Tek Döküman ─────────────────────────────────────────────────────
export const getDocument = async (req, res) => {
  try {
    const { collection, id } = req.params;
    const Model = MODELS[collection];
    if (!Model) {
      return res.status(404).json({ message: `Collection "${collection}" not found.` });
    }

    let query = Model.findById(id).lean();
    if (Model.schema.path('userId')) {
      query = query.populate('userId', 'email displayName');
    }
    const document = await query;

    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    // Şema alanları
    const fields = [];
    Model.schema.eachPath((path, schemaType) => {
      if (path === '__v') return;
      fields.push({
        name: path,
        type: schemaType.instance || 'Mixed',
        required: !!schemaType.isRequired,
        enum: schemaType.enumValues || null,
      });
    });

    res.json({ document, fields });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Döküman Güncelleme ──────────────────────────────────────────────
export const updateDocument = async (req, res) => {
  try {
    const { collection, id } = req.params;
    const Model = MODELS[collection];
    if (!Model) {
      return res.status(404).json({ message: `Collection "${collection}" not found.` });
    }

    const updates = req.body;
    // _id ve __v gibi alanları kaldır
    delete updates._id;
    delete updates.__v;

    const document = await Model.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    res.json({ message: 'Document updated successfully.', document });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── Döküman Silme ───────────────────────────────────────────────────
export const deleteDocument = async (req, res) => {
  try {
    const { collection, id } = req.params;
    const Model = MODELS[collection];
    if (!Model) {
      return res.status(404).json({ message: `Collection "${collection}" not found.` });
    }

    const document = await Model.findByIdAndDelete(id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    res.json({ message: 'Document deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Toplu Silme ─────────────────────────────────────────────────────
export const bulkDeleteDocuments = async (req, res) => {
  try {
    const { collection } = req.params;
    const { ids } = req.body;
    const Model = MODELS[collection];
    if (!Model) {
      return res.status(404).json({ message: `Collection "${collection}" not found.` });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Provide an array of IDs to delete.' });
    }

    const result = await Model.deleteMany({ _id: { $in: ids } });

    res.json({
      message: `${result.deletedCount} document(s) deleted.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Yeni Döküman Oluşturma ──────────────────────────────────────────
export const createDocument = async (req, res) => {
  try {
    const { collection } = req.params;
    const Model = MODELS[collection];
    if (!Model) {
      return res.status(404).json({ message: `Collection "${collection}" not found.` });
    }

    const document = await Model.create(req.body);

    res.status(201).json({ message: 'Document created successfully.', document });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── Raw MongoDB Query (İleri düzey) ─────────────────────────────────
export const rawQuery = async (req, res) => {
  try {
    const { collection } = req.params;
    const Model = MODELS[collection];
    if (!Model) {
      return res.status(404).json({ message: `Collection "${collection}" not found.` });
    }

    const { filter = {}, projection, sort, limit = 50 } = req.body;

    const documents = await Model.find(filter, projection)
      .sort(sort || { _id: -1 })
      .limit(Math.min(limit, 500))
      .lean();

    res.json({ documents, count: documents.length });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  FiDatabase, FiUsers, FiRepeat, FiPieChart, FiBox, FiClipboard, FiTrendingUp,
  FiLogOut, FiSearch, FiTrash2, FiEdit2, FiX, FiCheck, FiSave, FiPlus, FiAlertCircle, FiChevronLeft, FiChevronRight, FiActivity
} from 'react-icons/fi';
import './AdminPanel.css';

// Admin API
const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/admin` : '/api/admin'
});

adminApi.interceptors.request.use((config) => {
  const adminKey = localStorage.getItem('financeapp_admin_key');
  if (adminKey) {
    config.headers['x-admin-key'] = adminKey;
  }
  return config;
});

const ICONS = {
  users: <FiUsers />,
  transactions: <FiRepeat />,
  budgets: <FiPieChart />,
  pots: <FiBox />,
  recurringbills: <FiClipboard />,
  portfolios: <FiTrendingUp />,
  default: <FiDatabase />
};

export default function AdminPanel() {
  const [adminKey, setAdminKey] = useState(localStorage.getItem('financeapp_admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [collections, setCollections] = useState([]);
  
  const [loading, setLoading] = useState(true);

  // Tablo state
  const [currentCollection, setCurrentCollection] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [fields, setFields] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('edit'); // 'edit', 'create'
  const [editingDoc, setEditingDoc] = useState(null);
  
  const checkAuthAndLoad = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/dashboard');
      setIsAuthenticated(true);
      setStats(res.data);
      const colRes = await adminApi.get('/collections');
      setCollections(colRes.data.collections);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setIsAuthenticated(false);
        localStorage.removeItem('financeapp_admin_key');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminKey) {
      checkAuthAndLoad();
    } else {
      setLoading(false);
    }
  }, [adminKey, checkAuthAndLoad]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    
    const key = e.target.adminKey.value;
    try {
      const res = await axios.get((import.meta.env.VITE_API_BASE_URL || '/api') + '/admin/dashboard', {
        headers: { 'x-admin-key': key }
      });
      localStorage.setItem('financeapp_admin_key', key);
      setAdminKey(key);
      setIsAuthenticated(true);
      setStats(res.data);
      checkAuthAndLoad();
    } catch (err) {
      setLoginError('Geçersiz Admin Anahtarı');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('financeapp_admin_key');
    setAdminKey('');
    setIsAuthenticated(false);
  };

  // --- Collection Data Loading ---
  const loadCollectionData = useCallback(async (collectionName, page = 1) => {
    setLoading(true);
    try {
      const res = await adminApi.get(`/collections/${collectionName}`, {
        params: { page, limit: 20, search, sortField, sortOrder }
      });
      setCurrentCollection(collectionName);
      setDocuments(res.data.documents);
      setFields(res.data.fields);
      setPagination(res.data.pagination);
      setSelectedIds([]);
    } catch (err) {
      alert('Koleksiyon yüklenemedi: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [search, sortField, sortOrder]);

  useEffect(() => {
    if (activeTab !== 'dashboard' && isAuthenticated) {
      loadCollectionData(activeTab, 1);
    }
  }, [activeTab, search, sortField, sortOrder, isAuthenticated, loadCollectionData]);

  // --- Handlers ---
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const handleSelectAll = () => {
    if (selectedIds.length === documents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(documents.map(d => d._id));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      await adminApi.delete(`/collections/${activeTab}/${id}`);
      loadCollectionData(activeTab, pagination.page);
    } catch (err) {
      alert('Silinemedi: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Seçili ${selectedIds.length} kaydı silmek istediğinize emin misiniz?`)) return;
    try {
      await adminApi.post(`/collections/${activeTab}/bulk-delete`, { ids: selectedIds });
      loadCollectionData(activeTab, 1);
    } catch (err) {
      alert('Silinemedi: ' + err.message);
    }
  };

  const openEditModal = (doc) => {
    setModalMode('edit');
    // Format dates for inputs if necessary, but keep it simple for now
    setEditingDoc({ ...doc });
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setModalMode('create');
    const newDoc = {};
    fields.forEach(f => {
      if (f.name !== '_id' && f.name !== 'createdAt' && f.name !== 'updatedAt') {
        newDoc[f.name] = f.type === 'Number' ? 0 : f.type === 'Boolean' ? false : '';
      }
    });
    setEditingDoc(newDoc);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      // Temizle
      const payload = { ...editingDoc };
      delete payload._id;
      delete payload.__v;
      
      // Objeden string'e dönen ref'leri düzelt
      if (payload.userId && typeof payload.userId === 'object') {
        payload.userId = payload.userId._id;
      }

      if (modalMode === 'create') {
        await adminApi.post(`/collections/${activeTab}/create`, payload);
      } else {
        await adminApi.put(`/collections/${activeTab}/${editingDoc._id}`, payload);
      }
      setModalOpen(false);
      loadCollectionData(activeTab, pagination.page);
    } catch (err) {
      alert('Kaydedilemedi: ' + err.response?.data?.message || err.message);
    }
  };

  // --- Render ---
  if (loading && !stats && !loginError) {
    return (
      <div className="admin-root">
        <div className="admin-loading">
          <div className="admin-spinner"></div>
          Yükleniyor...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-root">
        <div className="admin-login-wrapper">
          <div className="admin-login-card">
            <div className="admin-logo">
              <h1>Admin Access</h1>
              <p>Veritabanı yönetimi için yetkili girişi yapın</p>
            </div>
            <form onSubmit={handleLogin}>
              {loginError && (
                <div className="admin-error-msg">
                  <FiAlertCircle /> {loginError}
                </div>
              )}
              <div className="admin-input-group">
                <label>Admin Secret Key</label>
                <input 
                  type="password" 
                  name="adminKey" 
                  placeholder="Erişim anahtarını girin..." 
                  autoComplete="off"
                  required 
                />
              </div>
              <button type="submit" className="admin-btn-primary" disabled={loading}>
                {loading ? 'Doğrulanıyor...' : 'Giriş Yap'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const renderDashboard = () => (
    <div className="admin-content">
      <div className="admin-topbar" style={{ padding: '0 0 1.5rem', background: 'transparent', border: 'none' }}>
        <h1>Dashboard Özeti</h1>
        <div className="admin-topbar-actions">
          <span className="db-badge">
            <span className="dot"></span> {stats?.database?.status} ({stats?.database?.name})
          </span>
        </div>
      </div>

      <div className="admin-stats-grid">
        {stats && Object.values(stats.stats || {}).map((st, i) => (
          <div className="admin-stat-card" key={i} style={{ '--card-color': st.color }} onClick={() => setActiveTab(Object.keys(stats.stats)[i])}>
            <div className="stat-label">{st.label}</div>
            <div className="stat-value">{st.count}</div>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-table-wrap">
          <h3 className="admin-section-title" style={{ padding: '1rem 1.5rem' }}>Son Kayıt Olan Kullanıcılar</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>İsim</th>
                <th>Tarih</th>
                <th>Onay</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentUsers?.map(u => (
                <tr key={u._id}>
                  <td>{u.email}</td>
                  <td>{u.displayName}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`cell-bool ${u.isVerified}`}>{u.isVerified ? 'Evet' : 'Hayır'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-table-wrap">
          <h3 className="admin-section-title" style={{ padding: '1rem 1.5rem' }}>Son İşlemler</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Tutar</th>
                <th>Tip</th>
                <th>Kategori</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentTransactions?.map(t => (
                <tr key={t._id}>
                  <td>{t.userId?.email || 'Bilinmiyor'}</td>
                  <td style={{ color: t.type === 'income' ? '#10b981' : '#ef4444' }}>
                    {t.amount} ₺
                  </td>
                  <td>
                    <span className={`cell-bool ${t.type === 'income'}`}>{t.type === 'income' ? 'Gelir' : 'Gider'}</span>
                  </td>
                  <td>{t.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCollection = () => {
    return (
      <div className="admin-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="admin-topbar" style={{ padding: '0 0 1rem', background: 'transparent', border: 'none' }}>
          <h1>{collections.find(c => c.key === activeTab)?.label || activeTab} Yönetimi</h1>
          <div className="admin-topbar-actions">
            {selectedIds.length > 0 && (
              <button className="admin-btn danger" onClick={handleBulkDelete}>
                <FiTrash2 /> Seçilileri Sil ({selectedIds.length})
              </button>
            )}
            <button className="admin-btn accent" onClick={openCreateModal}>
              <FiPlus /> Yeni Ekle
            </button>
          </div>
        </div>

        <div className="admin-table-toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-muted)' }} />
            <input 
              type="text" 
              className="admin-search-input" 
              placeholder="Ara..." 
              style={{ paddingLeft: '36px', width: '100%' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div className="admin-loading"><div className="admin-spinner"></div></div>
          ) : documents.length === 0 ? (
            <div className="admin-empty">
              <FiDatabase className="admin-empty-icon" />
              <p>Kayıt bulunamadı.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input 
                      type="checkbox" 
                      className="row-checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === documents.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  {fields.filter(f => !['passwordHash', '__v'].includes(f.name)).slice(0, 6).map(field => (
                    <th key={field.name} onClick={() => handleSort(field.name)} className={sortField === field.name ? 'sorted' : ''}>
                      {field.name} {sortField === field.name ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc._id}>
                    <td>
                      <input 
                        type="checkbox" 
                        className="row-checkbox"
                        checked={selectedIds.includes(doc._id)}
                        onChange={() => handleSelect(doc._id)}
                      />
                    </td>
                    {fields.filter(f => !['passwordHash', '__v'].includes(f.name)).slice(0, 6).map(field => {
                      let val = doc[field.name];
                      if (val && typeof val === 'object' && val.email) val = val.email; // Population handler
                      else if (typeof val === 'boolean') {
                        return <td key={field.name}><span className={`cell-bool ${val}`}>{val.toString()}</span></td>
                      }
                      else if (field.type === 'Date' || field.name === 'createdAt' || field.name === 'updatedAt') {
                        val = new Date(val).toLocaleString();
                      }
                      else if (field.name === '_id') {
                        return <td key={field.name} className="cell-id">{val.substring(0,8)}...</td>
                      }
                      return <td key={field.name}>{String(val || '')}</td>
                    })}
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button onClick={() => openEditModal(doc)} title="Düzenle"><FiEdit2 /></button>
                        <button className="delete-btn" onClick={() => handleDelete(doc._id)} title="Sil"><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="admin-pagination">
            <span>Toplam {pagination.total} kayıt, Sayfa {pagination.page} / {pagination.totalPages}</span>
            <div className="admin-pagination-btns">
              <button disabled={pagination.page <= 1} onClick={() => loadCollectionData(activeTab, pagination.page - 1)}>
                <FiChevronLeft />
              </button>
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => loadCollectionData(activeTab, pagination.page + 1)}>
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>Admin Panel</h2>
        </div>
        <nav className="admin-nav">
          <div className={`admin-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <FiPieChart /> <span>Dashboard Özeti</span>
          </div>
          <Link to="/admin/diagnostics" className="admin-nav-item" style={{ textDecoration: 'none' }}>
            <FiActivity /> <span>Diagnostik / Sistem Testi</span>
          </Link>

          <div className="admin-nav-section-title">Koleksiyonlar (Veritabanı)</div>
          {collections.map(col => (
            <div 
              key={col.key}
              className={`admin-nav-item ${activeTab === col.key ? 'active' : ''}`} 
              onClick={() => setActiveTab(col.key)}
            >
              <span style={{ color: col.color || 'var(--admin-muted)' }}>{ICONS[col.key] || ICONS.default}</span>
              <span>{col.label || col.key}</span>
              <span className="nav-count">{col.count}</span>
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-btn-logout" onClick={handleLogout}>
            <FiLogOut /> Çıkış Yap
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {activeTab === 'dashboard' ? renderDashboard() : renderCollection()}
      </main>

      {/* Modal */}
      {modalOpen && editingDoc && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>{modalMode === 'create' ? 'Yeni Kayıt Ekle' : 'Kaydı Düzenle'} ({activeTab})</h3>
              <button className="admin-modal-close" onClick={() => setModalOpen(false)}><FiX /></button>
            </div>
            <div className="admin-modal-body">
              {fields.map(field => {
                if (field.name === '_id' || field.name === '__v' || field.name === 'createdAt' || field.name === 'updatedAt') {
                   return null; // Düzenlenemez alanlar
                }

                // Population handling
                let currentVal = editingDoc[field.name] || '';
                if (currentVal && typeof currentVal === 'object') currentVal = currentVal._id;

                return (
                  <div className="admin-field-group" key={field.name}>
                    <label>
                      {field.name} {field.required && '*'} 
                      <span className="field-type">[{field.type}]</span>
                    </label>
                    {field.type === 'Boolean' ? (
                      <select 
                        value={currentVal.toString()} 
                        onChange={(e) => setEditingDoc({...editingDoc, [field.name]: e.target.value === 'true'})}
                      >
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : field.enum ? (
                       <select 
                        value={currentVal} 
                        onChange={(e) => setEditingDoc({...editingDoc, [field.name]: e.target.value})}
                      >
                        <option value="">Seçiniz...</option>
                        {field.enum.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === 'Number' ? (
                       <input 
                        type="number" 
                        value={currentVal} 
                        onChange={(e) => setEditingDoc({...editingDoc, [field.name]: Number(e.target.value)})}
                      />
                    ) : (
                       <input 
                        type="text" 
                        value={currentVal} 
                        onChange={(e) => setEditingDoc({...editingDoc, [field.name]: e.target.value})}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn" onClick={() => setModalOpen(false)}>İptal</button>
              <button className="admin-btn accent" onClick={handleSave}>
                <FiSave /> {modalMode === 'create' ? 'Oluştur' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

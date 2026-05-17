import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('financeapp_token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

// Sadece gerçek token hatalarında oturumu temizle.
// İş mantığı 401'leri (örn. "Current password is incorrect.") token'ı silmemeli;
// bu nedenle yalnızca middleware'in döndürdüğü iki mesajı tetikleyici sayıyoruz.
const TOKEN_INVALID_MESSAGES = new Set([
  'Unauthorized',
  'Invalid or expired token',
]);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      TOKEN_INVALID_MESSAGES.has(error.response?.data?.message)
    ) {
      localStorage.removeItem('financeapp_token');
    }
    return Promise.reject(error);
  }
);

export default api;

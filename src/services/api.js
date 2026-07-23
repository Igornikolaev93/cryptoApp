import axios from 'axios';

// Определяем базовый URL в зависимости от окружения
const getBaseURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://cryptoapp-backend-production-b4e6.up.railway.app';
  }
  return 'http://localhost:5000';
};

const api = axios.create({
  baseURL: `${getBaseURL()}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Интерцепторы
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['x-auth-token'];
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ✅ ВАЖНО: Используйте export default
export default api;
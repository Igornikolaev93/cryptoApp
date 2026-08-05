import axios from 'axios';

// === КОНФИГУРАЦИЯ ===
const CONFIG = {
  // Режимы: 'full' | 'server' | 'local'
  MODE: process.env.REACT_APP_MODE || 'full',
  
  // URL для режимов с сервером
  SERVER_URL: process.env.REACT_APP_API_URL || 'https://crypto-backend.vercel.app',
  LOCAL_URL: 'http://localhost:5000',
};

// === ЛОКАЛЬНОЕ ХРАНИЛИЩЕ (для режима local) ===
const STORAGE_KEY = 'crypto_app_local_data';

const getLocalStorage = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try { return JSON.parse(data); } catch (e) {}
  }
  return { users: [], operations: [], nextId: 1 };
};

const saveLocalStorage = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt_here');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const generateToken = (userId) => {
  const payload = { id: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  return btoa(JSON.stringify(payload));
};

const verifyToken = (token) => {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
};

// === ОСНОВНОЙ API КЛИЕНТ ===
class ApiClient {
  constructor() {
    this.mode = CONFIG.MODE;
    this.baseURL = this.mode === 'local' 
      ? '' 
      : (process.env.NODE_ENV === 'production' ? CONFIG.SERVER_URL : CONFIG.LOCAL_URL);
    this.axios = axios.create({
      baseURL: this.baseURL ? `${this.baseURL}/api` : '',
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    
    // Интерцептор для токена
    this.axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers['x-auth-token'] = token;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // === ОБЩИЙ МЕТОД ДЛЯ ВСЕХ РЕЖИМОВ ===
  async request(method, url, data = null) {
    // Локальный режим
    if (this.mode === 'local') {
      return this.localRequest(method, url, data);
    }
    
    // Режим с сервером
    try {
      const config = { method, url };
      if (data) config.data = data;
      const response = await this.axios(config);
      return response.data;
    } catch (error) {
      // Если сервер не доступен, переключаемся на локальный режим
      if (error.code === 'ERR_NETWORK' || error.response?.status === 404) {
        console.log('⚠️ Сервер недоступен, переключаемся на локальный режим');
        this.mode = 'local';
        return this.localRequest(method, url, data);
      }
      throw error;
    }
  }

  // === ЛОКАЛЬНЫЕ ЗАПРОСЫ (без сервера) ===
  async localRequest(method, url, data = null) {
    const storage = getLocalStorage();
    
    // --- РЕГИСТРАЦИЯ ---
    if (method === 'post' && url === '/auth/register') {
      const { username, email, password, full_name, phone } = data;
      
      if (storage.users.find(u => u.email === email || u.username === username)) {
        return {
          success: false,
          message: 'Пользователь с таким email или именем уже существует'
        };
      }
      
      const hashedPassword = await hashPassword(password);
      const newUser = {
        id: storage.nextId++,
        username,
        email,
        password: hashedPassword,
        full_name: full_name || '',
        phone: phone || '',
        is_verified: false,
        created_at: new Date().toISOString(),
        last_login: null
      };
      
      storage.users.push(newUser);
      saveLocalStorage(storage);
      
      const token = generateToken(newUser.id);
      
      return {
        success: true,
        message: 'Регистрация прошла успешно',
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          full_name: newUser.full_name
        },
        token
      };
    }
    
    // --- ВХОД ---
    if (method === 'post' && url === '/auth/login') {
      const { email, password } = data;
      const hashedPassword = await hashPassword(password);
      
      const user = storage.users.find(u => u.email === email && u.password === hashedPassword);
      if (!user) {
        return {
          success: false,
          message: 'Неверный email или пароль'
        };
      }
      
      user.last_login = new Date().toISOString();
      saveLocalStorage(storage);
      
      const token = generateToken(user.id);
      
      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          is_verified: user.is_verified
        }
      };
    }
    
    // --- ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ ---
    if (method === 'get' && url === '/auth/me') {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Токен не предоставлен' };
      }
      const payload = verifyToken(token);
      if (!payload) {
        return { success: false, message: 'Недействительный токен' };
      }
      
      const user = storage.users.find(u => u.id === payload.id);
      if (!user) {
        return { success: false, message: 'Пользователь не найден' };
      }
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          is_verified: user.is_verified,
          created_at: user.created_at
        }
      };
    }
    
    // --- СОЗДАНИЕ ОПЕРАЦИИ ---
    if (method === 'post' && url === '/operations') {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Токен не предоставлен' };
      }
      const payload = verifyToken(token);
      if (!payload) {
        return { success: false, message: 'Недействительный токен' };
      }
      
      const {
        operation_type,
        crypto_currency,
        crypto_amount,
        fiat_currency,
        fiat_amount,
        payment_method,
        wallet_address,
        notes
      } = data;
      
      const fee = parseFloat(fiat_amount) * 0.01;
      const newOperation = {
        id: storage.nextId++,
        user_id: payload.id,
        operation_type,
        crypto_currency: crypto_currency.toUpperCase(),
        crypto_amount: parseFloat(crypto_amount),
        fiat_currency: fiat_currency.toUpperCase(),
        fiat_amount: parseFloat(fiat_amount),
        fee_amount: fee,
        fee_currency: fiat_currency.toUpperCase(),
        payment_method: payment_method || null,
        wallet_address: wallet_address || null,
        status: 'pending',
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      storage.operations.push(newOperation);
      saveLocalStorage(storage);
      
      return {
        success: true,
        message: 'Операция создана',
        operationId: newOperation.id,
        operation: newOperation
      };
    }
    
    // --- ПОЛУЧЕНИЕ ОПЕРАЦИЙ ---
    if (method === 'get' && url === '/operations') {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Токен не предоставлен' };
      }
      const payload = verifyToken(token);
      if (!payload) {
        return { success: false, message: 'Недействительный токен' };
      }
      
      const userOperations = storage.operations.filter(o => o.user_id === payload.id);
      
      return {
        success: true,
        operations: userOperations,
        count: userOperations.length
      };
    }
    
    // --- ОТМЕНА ОПЕРАЦИИ ---
    if (method === 'patch' && url.startsWith('/operations/') && url.endsWith('/cancel')) {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'Токен не предоставлен' };
      }
      const payload = verifyToken(token);
      if (!payload) {
        return { success: false, message: 'Недействительный токен' };
      }
      
      const operationId = parseInt(url.split('/')[2]);
      const operation = storage.operations.find(o => o.id === operationId && o.user_id === payload.id);
      
      if (!operation) {
        return { success: false, message: 'Операция не найдена' };
      }
      
      if (operation.status !== 'pending') {
        return { success: false, message: 'Невозможно отменить операцию в текущем статусе' };
      }
      
      operation.status = 'cancelled';
      operation.updated_at = new Date().toISOString();
      saveLocalStorage(storage);
      
      return {
        success: true,
        message: 'Операция отменена'
      };
    }
    
    // === СТАТУС БД (для проверки) ===
    if (method === 'get' && url === '/db-status') {
      return {
        success: true,
        connected: false,
        mode: 'local',
        message: 'Локальный режим (без сервера)',
        stats: {
          users: storage.users.length,
          operations: storage.operations.length
        },
        timestamp: new Date().toISOString()
      };
    }
    
    return { success: false, message: 'Маршрут не найден' };
  }

  // === ОБЕРТКИ ДЛЯ МЕТОДОВ ===
  async post(url, data) {
    return this.request('post', url, data);
  }

  async get(url) {
    return this.request('get', url);
  }

  async patch(url, data) {
    return this.request('patch', url, data);
  }

  async put(url, data) {
    return this.request('put', url, data);
  }

  async delete(url) {
    return this.request('delete', url);
  }
}

// === ЕДИНЫЙ ЭКЗЕМПЛЯР API ===
const api = new ApiClient();

export default api;
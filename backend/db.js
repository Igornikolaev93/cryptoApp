// backend/db.js
const { Pool } = require('pg');
require('dotenv').config();

let pool = null;
let isDatabaseConnected = false;

/**
 * Инициализация подключения к базе данных
 */
function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL не настроен в Environment Variables');
    return null;
  }

  try {
    console.log('🔧 Инициализация подключения к базе данных...');
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 10
    });

    // Тестируем подключение
    pool.connect((err, client, release) => {
      if (err) {
        console.error('❌ Ошибка подключения к базе:', err.message);
        isDatabaseConnected = false;
      } else {
        console.log('✅ Успешное подключение к PostgreSQL!');
        isDatabaseConnected = true;
        release();
      }
    });

    // Обработчик ошибок пула
    pool.on('error', (err) => {
      console.error('❌ Неожиданная ошибка в пуле соединений:', err.message);
      isDatabaseConnected = false;
    });

    return pool;
  } catch (error) {
    console.error('❌ Ошибка инициализации пула:', error.message);
    return null;
  }
}

/**
 * Безопасное выполнение запросов к базе
 */
async function query(sql, params = []) {
  if (!pool || !isDatabaseConnected) {
    console.log('⚠️ База данных не подключена, пытаемся переподключиться...');
    initializeDatabase();
    throw new Error('База данных не подключена или спит. Пожалуйста, попробуйте снова через 30 секунд.');
  }

  try {
    const client = await pool.connect();
    const result = await client.query(sql, params);
    client.release();
    return result;
  } catch (error) {
    console.error('❌ Ошибка выполнения запроса:', error.message);
    
    // Если ошибка связана с подключением
    if (error.code === '57P01' || 
        error.message.includes('connection') || 
        error.message.includes('terminated') ||
        error.message.includes('getaddrinfo')) {
      console.log('🔄 База данных спит, переподключаемся...');
      isDatabaseConnected = false;
      initializeDatabase();
      throw new Error('База данных спит. Пожалуйста, попробуйте снова через 30 секунд.');
    }
    
    throw error;
  }
}

/**
 * Проверка подключения к базе
 */
async function checkConnection() {
  try {
    if (!pool) {
      return { connected: false, message: 'Пул не инициализирован' };
    }
    
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { connected: true, message: 'База данных подключена' };
  } catch (error) {
    return { connected: false, message: error.message };
  }
}

// Инициализируем подключение при загрузке модуля
initializeDatabase();

// Авто-проверка подключения каждые 10 минут
setInterval(async () => {
  if (isDatabaseConnected) {
    try {
      await query('SELECT 1');
      console.log('⏰ Keep-alive ping отправлен');
    } catch (error) {
      console.log('⚠️ База данных уснула');
      isDatabaseConnected = false;
    }
  }
}, 10 * 60 * 1000);

module.exports = {
  query,
  pool: () => pool,
  isConnected: () => isDatabaseConnected,
  checkConnection,
  reconnect: initializeDatabase
};
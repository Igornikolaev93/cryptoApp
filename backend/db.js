const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: {
    rejectUnauthorized: false // ОБЯЗАТЕЛЬНО для Render
  },
  // Дополнительные настройки пула
  max: 10, // максимальное количество клиентов в пуле
  idleTimeoutMillis: 30000, // время бездействия перед закрытием
  connectionTimeoutMillis: 2000, // время ожидания подключения
});

// Проверка подключения при старте
pool.on('connect', () => {
  console.log('✅ Подключение к базе данных установлено');
});

pool.on('error', (err) => {
  console.error('❌ Ошибка подключения к базе:', err.message);
});

module.exports = pool;
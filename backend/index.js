const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // обязательно для Render PostgreSQL
  }
});

// Проверка подключения к базе
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('✅ Successfully connected to PostgreSQL database');
    release();
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Проверка работы сервера
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Backend is working with PostgreSQL!',
    timestamp: new Date().toISOString()
  });
});

// Проверка подключения к базе
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW(), current_database()');
    res.json({ 
      success: true,
      time: result.rows[0].now,
      database: result.rows[0].current_database,
      message: '✅ PostgreSQL connection successful!'
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      message: '❌ Database connection failed'
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CryptoApp Backend API',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      root: '/',
      health: '/health',
      api: '/api',
      dbTest: '/api/db-test',
      initDb: '/api/init-db',
      users: '/api/users',
      operations: '/api/operations'
    },
    documentation: 'Use the endpoints above to interact with the API'
  });
});

// Создание таблиц из вашего database.sql
app.get('/api/init-db', async (req, res) => {
  try {
    // Создаем таблицу users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создаем таблицу operations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS operations (
        operation_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id),
        operation_type VARCHAR(50) NOT NULL,
        crypto_currency VARCHAR(50),
        crypto_amount NUMERIC,
        fiat_currency VARCHAR(50),
        fiat_amount NUMERIC,
        payment_method VARCHAR(100),
        wallet_address VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    res.json({ 
      success: true,
      message: '✅ Database tables created successfully!',
      tables: ['users', 'operations']
    });
  } catch (err) {
    console.error('Database init error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      message: '❌ Failed to create tables'
    });
  }
});

// Health check для Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
});
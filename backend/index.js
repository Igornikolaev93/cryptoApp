const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;

// Подключение к PostgreSQL Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// ========== API ЭНДПОИНТЫ ==========

// 1. Корневой маршрут
app.get('/', (req, res) => {
  res.json({
    message: '🚀 CryptoApp Backend API',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api',
      dbInfo: '/api/db-info',
      initDb: '/api/init-db',
      tables: '/api/tables',
      seedData: '/api/seed-data',
      users: '/api/users',
      operations: '/api/operations'
    }
  });
});

// 2. Health check для Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// 3. Основной API endpoint
app.get('/api', (req, res) => {
  res.json({
    message: '📊 CryptoApp API',
    version: '1.0.0',
    database: process.env.DATABASE_URL ? 'Connected' : 'Not configured',
    endpoints: [
      'GET /',
      'GET /health',
      'GET /api',
      'GET /api/db-info',
      'GET /api/init-db',
      'GET /api/tables',
      'GET /api/seed-data',
      'GET /api/users',
      'POST /api/users',
      'GET /api/operations',
      'POST /api/operations'
    ]
  });
});

// 4. Информация о базе данных
app.get('/api/db-info', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        current_database() as database,
        version() as version,
        current_user as user,
        inet_server_addr() as host,
        inet_server_port() as port
    `);
    
    res.json({
      success: true,
      database: result.rows[0],
      connection: 'Active',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// 5. Инициализация таблиц
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
      tables: ['users', 'operations'],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Database init error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      message: '❌ Failed to create database tables',
      timestamp: new Date().toISOString()
    });
  }
});

// 6. Проверка существующих таблиц
app.get('/api/tables', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    res.json({
      success: true,
      count: result.rowCount,
      tables: result.rows.map(row => row.table_name),
      database: 'cryptoapp',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 7. Тестовые данные
app.get('/api/seed-data', async (req, res) => {
  try {
    // Очищаем таблицы
    await pool.query('TRUNCATE TABLE operations, users RESTART IDENTITY CASCADE');
    
    // Добавляем тестовых пользователей
    const users = [
      ['alex_crypto', 'alex@example.com', 'hashed_pass_123'],
      ['maria_trader', 'maria@example.com', 'hashed_pass_456'],
      ['john_investor', 'john@example.com', 'hashed_pass_789']
    ];
    
    for (const [username, email, password_hash] of users) {
      await pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)',
        [username, email, password_hash]
      );
    }
    
    // Добавляем тестовые операции
    const operations = [
      [1, 'deposit', 'BTC', 0.5, 'USD', 25000, 'credit_card', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'completed'],
      [1, 'withdrawal', 'ETH', 2.5, 'USD', 8000, 'bank_transfer', '0x742d35Cc6634C0532925a3b844Bc9e0a2A1C1F6E', 'pending'],
      [2, 'deposit', 'LTC', 10, 'EUR', 800, 'paypal', 'LbTjM7Q8R5o4qFcLxH9wZ2N6yK3pA8sD1f', 'completed']
    ];
    
    for (const [user_id, operation_type, crypto_currency, crypto_amount, fiat_currency, fiat_amount, payment_method, wallet_address, status] of operations) {
      await pool.query(
        `INSERT INTO operations (
          user_id, operation_type, crypto_currency, crypto_amount,
          fiat_currency, fiat_amount, payment_method, wallet_address, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [user_id, operation_type, crypto_currency, crypto_amount, fiat_currency, fiat_amount, payment_method, wallet_address, status]
      );
    }
    
    res.json({
      success: true,
      message: '✅ Test data seeded successfully!',
      users_added: 3,
      operations_added: 3,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 8. CRUD для пользователей
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT user_id, username, email, created_at FROM users ORDER BY created_at DESC');
    res.json({
      success: true,
      count: result.rowCount,
      users: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. CRUD для операций
app.get('/api/operations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, u.username 
      FROM operations o 
      LEFT JOIN users u ON o.user_id = u.user_id 
      ORDER BY o.created_at DESC
    `);
    res.json({
      success: true,
      count: result.rowCount,
      operations: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    availableRoutes: [
      'GET /',
      'GET /health',
      'GET /api',
      'GET /api/db-info',
      'GET /api/init-db',
      'GET /api/tables',
      'GET /api/seed-data',
      'GET /api/users',
      'GET /api/operations'
    ],
    timestamp: new Date().toISOString()
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Available at: https://cryptoapp-backend.onrender.com`);
});
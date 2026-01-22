const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;

// ========== НАСТРОЙКА БАЗЫ ДАННЫХ ==========

let pool = null;
let isDatabaseConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

/**
 * Инициализация подключения к базе данных
 */
async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL не настроен в Environment Variables');
    return;
  }

  // Если уже пытались подключиться много раз - ждем дольше
  if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    const waitTime = Math.min(connectionAttempts * 30, 300); // максимум 5 минут
    console.log(`⏳ Много неудачных попыток подключения. Ждем ${waitTime} секунд...`);
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
  }

  connectionAttempts++;

  try {
    console.log(`🔧 Попытка подключения к базе данных #${connectionAttempts}...`);
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 15000, // 15 секунд на подключение
      idleTimeoutMillis: 30000, // 30 секунд неактивности
      max: 10 // максимальное количество соединений
    });

    // Тестируем подключение
    const client = await pool.connect();
    console.log('✅ Успешное подключение к PostgreSQL!');
    
    // Получаем информацию о базе
    const dbInfo = await client.query('SELECT version(), current_database()');
    console.log(`📊 База данных: ${dbInfo.rows[0].current_database}`);
    console.log(`🔧 Версия PostgreSQL: ${dbInfo.rows[0].version.split(',')[0]}`);
    
    client.release();
    isDatabaseConnected = true;
    connectionAttempts = 0; // Сбрасываем счетчик при успешном подключении

    // Настраиваем обработчики событий
    pool.on('error', (err) => {
      console.error('❌ Неожиданная ошибка в пуле соединений:', err.message);
      isDatabaseConnected = false;
    });

    // Авто-пробуждение базы каждые 10 минут
    startKeepAlive();

  } catch (error) {
    console.error(`❌ Ошибка подключения к базе (попытка ${connectionAttempts}):`, error.message);
    isDatabaseConnected = false;
    
    // Пытаемся переподключиться через увеличивающийся интервал
    const retryDelay = Math.min(connectionAttempts * 10, 120) * 1000; // от 10 до 120 секунд
    console.log(`⏳ Следующая попытка через ${retryDelay / 1000} секунд...`);
    
    setTimeout(initializeDatabase, retryDelay);
  }
}

/**
 * Функция для поддержания базы в активном состоянии
 */
function startKeepAlive() {
  if (!pool) return;

  // Ping базу каждые 10 минут
  const keepAliveInterval = setInterval(async () => {
    if (!isDatabaseConnected) {
      clearInterval(keepAliveInterval);
      return;
    }

    try {
      const client = await pool.connect();
      await client.query('SELECT 1 as ping');
      client.release();
      console.log('⏰ Keep-alive ping отправлен');
    } catch (error) {
      console.log('⚠️ База данных уснула, переподключаемся...');
      isDatabaseConnected = false;
      clearInterval(keepAliveInterval);
      initializeDatabase();
    }
  }, 10 * 60 * 1000); // 10 минут
}

/**
 * Безопасное выполнение запросов к базе с обработкой спящей базы
 */
async function safeQuery(sql, params = []) {
  if (!isDatabaseConnected || !pool) {
    throw new Error('База данных не подключена или спит');
  }

  try {
    const client = await pool.connect();
    const result = await client.query(sql, params);
    client.release();
    return result;
  } catch (error) {
    // Если ошибка связана с подключением, помечаем базу как отключенную
    if (error.code === '57P01' || error.message.includes('connection') || error.message.includes('terminated')) {
      console.log('⚠️ Обнаружена спящая база, переподключаемся...');
      isDatabaseConnected = false;
      initializeDatabase();
    }
    throw error;
  }
}

// ========== ИНИЦИАЛИЗАЦИЯ СЕРВЕРА ==========

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));
app.use(express.json());

// Middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// ========== API ЭНДПОИНТЫ ==========

// 1. Корневой маршрут
app.get('/', (req, res) => {
  res.json({
    message: '🚀 CryptoApp Backend API',
    status: 'online',
    database: isDatabaseConnected ? '✅ Подключена' : '⏳ Спит/Подключается',
    server_time: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api',
      db_status: '/api/db-status',
      db_info: '/api/db-info',
      wake_db: '/api/wake-db',
      init_db: '/api/init-db',
      tables: '/api/tables',
      seed_data: '/api/seed-data',
      users: '/api/users',
      operations: '/api/operations'
    }
  });
});

// 2. Health check (всегда работает, даже если база спит)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    server: 'running',
    database: isDatabaseConnected ? 'connected' : 'sleeping',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    note: 'База на free плане спит после 15 минут неактивности'
  });
});

// 3. Статус базы данных
app.get('/api/db-status', (req, res) => {
  res.json({
    success: true,
    database: {
      status: isDatabaseConnected ? 'AWAKE' : 'SLEEPING',
      connected: isDatabaseConnected,
      url_configured: !!process.env.DATABASE_URL,
      plan: 'Free',
      sleep_after: '15 минут неактивности',
      wake_up_time: '30-60 секунд'
    },
    actions: [
      'GET /api/wake-db - принудительно разбудить базу',
      'GET /health - простой health check',
      'Ждать 30-60 секунд после первого запроса'
    ],
    timestamp: new Date().toISOString()
  });
});

// 4. Информация о базе данных
app.get('/api/db-info', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(400).json({
      success: false,
      message: 'DATABASE_URL не настроен',
      action: 'Добавьте DATABASE_URL в Environment Variables',
      timestamp: new Date().toISOString()
    });
  }

  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      message: 'База данных спит (free план)',
      action: 'Используйте /api/wake-db или подождите 30-60 секунд',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await safeQuery(`
      SELECT 
        current_database() as database,
        version() as version,
        current_user as username,
        inet_server_addr() as host,
        inet_server_port() as port,
        pg_database_size(current_database()) as size_bytes
    `);

    res.json({
      success: true,
      message: '✅ База данных активна и подключена!',
      database: result.rows[0],
      connection: 'stable',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка подключения к базе',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 5. Принудительное пробуждение базы
app.get('/api/wake-db', async (req, res) => {
  console.log('🔔 Запрос на принудительное пробуждение базы...');
  
  if (!process.env.DATABASE_URL) {
    return res.status(400).json({
      success: false,
      message: 'DATABASE_URL не настроен',
      timestamp: new Date().toISOString()
    });
  }

  // Сбрасываем счетчик попыток для быстрого переподключения
  connectionAttempts = 0;
  
  // Запускаем инициализацию
  initializeDatabase();
  
  res.json({
    success: true,
    message: '🔔 Запущен процесс пробуждения базы данных',
    note: 'База на free плане просыпается за 30-60 секунд',
    check_status: 'Используйте /api/db-status для проверки',
    timestamp: new Date().toISOString()
  });
});

// 6. Инициализация таблиц
app.get('/api/init-db', async (req, res) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      message: 'База данных спит',
      action: 'Сначала разбудите базу: /api/wake-db',
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('🛠️ Начинаю инициализацию базы данных...');

    // Таблица users
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Таблица users создана');

    // Таблица operations
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS operations (
        operation_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        operation_type VARCHAR(50) NOT NULL,
        crypto_currency VARCHAR(50),
        crypto_amount NUMERIC(20, 8),
        fiat_currency VARCHAR(50),
        fiat_amount NUMERIC(20, 2),
        payment_method VARCHAR(100),
        wallet_address VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Таблица operations создана');

    // Индексы для производительности
    await safeQuery('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await safeQuery('CREATE INDEX IF NOT EXISTS idx_operations_user_id ON operations(user_id)');
    await safeQuery('CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status)');
    await safeQuery('CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at)');
    console.log('✅ Индексы созданы');

    res.json({
      success: true,
      message: '✅ База данных успешно инициализирована!',
      tables: ['users', 'operations'],
      indexes: [
        'idx_users_email',
        'idx_operations_user_id', 
        'idx_operations_status',
        'idx_operations_created_at'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Ошибка инициализации базы:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания таблиц',
      error: error.message,
      error_code: error.code,
      timestamp: new Date().toISOString()
    });
  }
});

// 7. Просмотр существующих таблиц
app.get('/api/tables', async (req, res) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      message: 'База данных спит',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await safeQuery(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = t.table_name) as columns_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    res.json({
      success: true,
      count: result.rowCount,
      tables: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 8. Добавление тестовых данных
app.get('/api/seed-data', async (req, res) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      message: 'База данных спит',
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('🌱 Добавляю тестовые данные...');

    // Очищаем существующие данные
    await safeQuery('TRUNCATE TABLE operations, users RESTART IDENTITY CASCADE');
    console.log('✅ Старые данные очищены');

    // Добавляем тестовых пользователей
    const users = [
      ['alex_crypto', 'alex@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK3aV7QHpqYfL3jqJhC.6Z5QY8WbS'], // password: Test123!
      ['maria_trader', 'maria@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK3aV7QHpqYfL3jqJhC.6Z5QY8WbS'],
      ['john_investor', 'john@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK3aV7QHpqYfL3jqJhC.6Z5QY8WbS']
    ];

    for (const [username, email, password_hash] of users) {
      await safeQuery(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)',
        [username, email, password_hash]
      );
    }
    console.log('✅ 3 тестовых пользователя добавлены');

    // Добавляем тестовые операции
    const operations = [
      [1, 'deposit', 'BTC', 0.5, 'USD', 25000, 'credit_card', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'completed'],
      [1, 'withdrawal', 'ETH', 2.5, 'USD', 8000, 'bank_transfer', '0x742d35Cc6634C0532925a3b844Bc9e0a2A1C1F6E', 'pending'],
      [2, 'deposit', 'LTC', 10, 'EUR', 800, 'paypal', 'LbTjM7Q8R5o4qFcLxH9wZ2N6yK3pA8sD1f', 'completed'],
      [3, 'exchange', 'XRP', 500, 'GBP', 300, 'crypto_wallet', 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh', 'completed']
    ];

    for (const [user_id, operation_type, crypto_currency, crypto_amount, fiat_currency, fiat_amount, payment_method, wallet_address, status] of operations) {
      await safeQuery(
        `INSERT INTO operations (
          user_id, operation_type, crypto_currency, crypto_amount,
          fiat_currency, fiat_amount, payment_method, wallet_address, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [user_id, operation_type, crypto_currency, crypto_amount, fiat_currency, fiat_amount, payment_method, wallet_address, status]
      );
    }
    console.log('✅ 4 тестовые операции добавлены');

    res.json({
      success: true,
      message: '✅ Тестовые данные успешно добавлены!',
      data: {
        users: 3,
        operations: 4,
        currencies: ['BTC', 'ETH', 'LTC', 'XRP'],
        statuses: ['completed', 'pending']
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Ошибка добавления тестовых данных:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 9. Получить всех пользователей
app.get('/api/users', async (req, res) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      message: 'База данных спит',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await safeQuery(`
      SELECT 
        user_id,
        username,
        email,
        created_at,
        (SELECT COUNT(*) FROM operations WHERE user_id = users.user_id) as operations_count
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      count: result.rowCount,
      users: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 10. Получить все операции
app.get('/api/operations', async (req, res) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      message: 'База данных спит',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await safeQuery(`
      SELECT 
        o.operation_id,
        o.operation_type,
        o.crypto_currency,
        o.crypto_amount,
        o.fiat_currency,
        o.fiat_amount,
        o.payment_method,
        o.status,
        o.created_at,
        u.username,
        u.email
      FROM operations o
      JOIN users u ON o.user_id = u.user_id
      ORDER BY o.created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      count: result.rowCount,
      operations: result.rows,
      summary: {
        total_amount: result.rows.reduce((sum, op) => sum + (parseFloat(op.fiat_amount) || 0), 0),
        by_status: result.rows.reduce((acc, op) => {
          acc[op.status] = (acc[op.status] || 0) + 1;
          return acc;
        }, {}),
        by_type: result.rows.reduce((acc, op) => {
          acc[op.operation_type] = (acc[op.operation_type] || 0) + 1;
          return acc;
        }, {})
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 11. Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Маршрут не найден',
    path: req.originalUrl,
    available_routes: [
      'GET /',
      'GET /health',
      'GET /api/db-status',
      'GET /api/db-info',
      'GET /api/wake-db',
      'GET /api/init-db',
      'GET /api/tables',
      'GET /api/seed-data',
      'GET /api/users',
      'GET /api/operations'
    ],
    timestamp: new Date().toISOString()
  });
});

// ========== ЗАПУСК СЕРВЕРА ==========

// Запускаем инициализацию базы при старте сервера
app.listen(PORT, async () => {
  console.log('='.repeat(50));
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Доступен по адресу: https://cryptoapp-backend.onrender.com`);
  console.log(`🗄️ База данных: ${process.env.DATABASE_URL ? 'Настроена' : 'НЕ настроена!'}`);
  
  if (process.env.DATABASE_URL) {
    console.log(`🔧 Инициализация подключения к базе...`);
    initializeDatabase();
  } else {
    console.log(`❌ ВАЖНО: Добавьте DATABASE_URL в Environment Variables!`);
    console.log(`💡 Действие: Render Dashboard → cryptoapp-backend → Environment`);
  }
  
  console.log('='.repeat(50));
  console.log(`📋 Полезные ссылки:`);
  console.log(`   📊 Статус: https://cryptoapp-backend.onrender.com/`);
  console.log(`   💚 Health: https://cryptoapp-backend.onrender.com/health`);
  console.log(`   🗄️ DB Status: https://cryptoapp-backend.onrender.com/api/db-status`);
  console.log(`   🔔 Wake DB: https://cryptoapp-backend.onrender.com/api/wake-db`);
  console.log(`   🛠️ Init DB: https://cryptoapp-backend.onrender.com/api/init-db`);
  console.log('='.repeat(50));
});

// Обработка graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Получен сигнал SIGTERM, завершаем работу...');
  
  if (pool) {
    try {
      await pool.end();
      console.log('✅ Пул соединений с базой закрыт');
    } catch (error) {
      console.error('❌ Ошибка при закрытии пула:', error);
    }
  }
  
  process.exit(0);
});

module.exports = app;
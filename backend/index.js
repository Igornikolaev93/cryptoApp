const express = require('express');
const cors = require('cors');
const db = require('./db');  // ← Изменено с '../db' на './db'
const authRoutes = require('./routes/auth');
const operationRoutes = require('./routes/operations');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Настройка CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Логирование (только в dev)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
        next();
    });
}

// ============================================
// Системные эндпоинты
// ============================================

app.get('/', (req, res) => {
    res.json({
        message: '🚀 CryptoApp Backend API (Railway)',
        status: 'online',
        version: process.env.npm_package_version || '1.0.0',
        database: db.isConnected() ? '✅ Подключена' : '⏳ Не подключена',
        server_time: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/health', async (req, res) => {
    const dbStatus = db.isConnected();
    let dbInfo = { connected: dbStatus };
    
    if (dbStatus) {
        try {
            const result = await db.query('SELECT 1 as test');
            dbInfo = { ...dbInfo, test: 'success' };
        } catch (error) {
            dbInfo = { ...dbInfo, test: 'failed', error: error.message };
        }
    }
    
    res.json({
        status: 'OK',
        server: 'running',
        railway: true,
        database: dbStatus ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        dbInfo
    });
});

app.get('/api/db-status', async (req, res) => {
    try {
        const connected = db.isConnected();
        if (!connected) {
            return res.json({
                success: false,
                connected: false,
                message: 'База данных не подключена',
                timestamp: new Date().toISOString()
            });
        }
        
        const result = await db.query(
            'SELECT DATABASE() as database, USER() as user, VERSION() as version'
        );
        
        res.json({
            success: true,
            connected: true,
            database: result.rows[0]?.database || 'unknown',
            user: result.rows[0]?.user || 'unknown',
            version: result.rows[0]?.version || 'unknown',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            success: false,
            connected: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.post('/api/db-reconnect', async (req, res) => {
    try {
        await db.reconnect();
        res.json({
            success: true,
            message: 'Переподключение выполнено',
            connected: db.isConnected(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// Основные маршруты API
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/operations', operationRoutes);

// ============================================
// Обработка 404
// ============================================

app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Маршрут не найден',
        path: req.originalUrl
    });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
    console.error('❌ Ошибка сервера:', err.stack);
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Инициализация БД при первом запросе
let dbInitialized = false;

// Middleware для инициализации БД
app.use(async (req, res, next) => {
    if (!dbInitialized) {
        try {
            await db.initializeDatabase();
            dbInitialized = true;
            console.log('✅ База данных инициализирована');
        } catch (error) {
            console.error('❌ Ошибка инициализации БД:', error.message);
        }
    }
    next();
});

// Запуск сервера (для Railway)
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('='.repeat(50));
});

// Экспорт для Vercel (если нужно)
module.exports = app;
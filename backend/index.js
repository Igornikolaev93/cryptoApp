// backend/index.js
const express = require('express');
const cors = require('cors');
const db = require('./db');
const authRoutes = require('./routes/auth');
const operationRoutes = require('./routes/operations');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
    credentials: true
}));

app.use(express.json());

// Логирование запросов
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// ============================================
// Эндпоинты для проверки БД
// ============================================

// Корневой маршрут
app.get('/', (req, res) => {
    res.json({
        message: '🚀 CryptoApp Backend API',
        status: 'online',
        database: db.isConnected() ? '✅ Подключена' : '⏳ Не подключена',
        server_time: new Date().toISOString()
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        server: 'running',
        database: db.isConnected() ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Проверка подключения к БД
app.get('/api/db-status', async (req, res) => {
    try {
        const connected = db.isConnected();
        const result = await db.query('SELECT 1 as test, DATABASE() as database, USER() as user');
        
        res.json({
            success: true,
            connected: connected,
            database: result.rows[0].database,
            user: result.rows[0].user,
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

// Принудительное переподключение
app.get('/api/db-reconnect', async (req, res) => {
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
// Подключение маршрутов
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/operations', operationRoutes);

// ============================================
// Обработка ошибок
// ============================================

app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Маршрут не найден',
        path: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Ошибка сервера:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ============================================
// Запуск сервера
// ============================================

app.listen(PORT, async () => {
    console.log('='.repeat(50));
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('='.repeat(50));
    
    // Инициализация БД
    await db.initializeDatabase();
});

module.exports = app;
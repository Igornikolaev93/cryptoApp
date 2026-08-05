const express = require('express');
const cors = require('cors');
const db = require('./db');
const authRoutes = require('./routes/auth');
const operationRoutes = require('./routes/operations');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

console.log('='.repeat(50));
console.log('🚀 Запуск сервера...');
console.log('🔍 Проверка переменных окружения:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ установлена' : '❌ не установлена');
console.log('='.repeat(50));

app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Системные эндпоинты
app.get('/', (req, res) => {
    res.json({
        message: '🚀 CryptoApp Backend API',
        status: 'online',
        version: process.env.npm_package_version || '1.0.0',
        database: db.isConnected() ? '✅ Подключена' : '⏳ Не подключена',
        server_time: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/health', async (req, res) => {
    const dbStatus = db.isConnected();
    res.json({
        status: 'OK',
        server: 'running',
        database: dbStatus ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
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
            'SELECT current_database() as database, current_user as user, version() as version'
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

// Основные маршруты
app.use('/api/auth', authRoutes);
app.use('/api/operations', operationRoutes);

// Обработка ошибок
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Маршрут не найден',
        path: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Ошибка сервера:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Внутренняя ошибка сервера'
    });
});

// Запуск
app.listen(PORT, async () => {
    console.log('='.repeat(50));
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log('='.repeat(50));
    
    try {
        await db.initializeDatabase();
        console.log('✅ Инициализация БД завершена');
    } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error.message);
    }
});

module.exports = app;
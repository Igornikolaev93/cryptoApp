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

// === НАСТРОЙКА CORS (ДО ВСЕХ МАРШРУТОВ) ===
app.use(cors({
    origin: [
        'https://igornikolaev93.github.io',
        'https://crypto-backend.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Дополнительные заголовки для всех ответов
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://igornikolaev93.github.io');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Обрабатываем preflight запросы
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === СИСТЕМНЫЕ ЭНДПОИНТЫ ===
app.get('/', (req, res) => {
    const isDbConnected = db.isConnected();
    res.json({
        message: '🚀 CryptoApp Backend API',
        status: 'online',
        version: '1.0.0',
        database: isDbConnected ? '✅ Подключена' : '🧠 Режим памяти',
        storage_mode: isDbConnected ? 'Supabase PostgreSQL' : 'In-Memory (Session)',
        server_time: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/health', async (req, res) => {
    res.json({
        status: 'OK',
        server: 'running',
        database: db.isConnected() ? 'connected' : 'memory_mode',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/db-status', async (req, res) => {
    try {
        const connected = db.isConnected();
        
        if (!connected) {
            const storage = db.getStorage ? db.getStorage() : null;
            return res.json({
                success: true,
                connected: false,
                mode: 'memory',
                message: 'Используется временное хранилище в памяти',
                stats: storage ? {
                    users: storage.users.length,
                    operations: storage.operations.length
                } : null,
                timestamp: new Date().toISOString()
            });
        }
        
        const result = await db.query(
            'SELECT current_database() as database, current_user as user, version() as version'
        );
        
        res.json({
            success: true,
            connected: true,
            mode: 'database',
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

// === ОСНОВНЫЕ МАРШРУТЫ ===
app.use('/api/auth', authRoutes);
app.use('/api/operations', operationRoutes);

// === ОБРАБОТКА 404 ===
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Маршрут не найден',
        path: req.originalUrl
    });
});

// === ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК ===
app.use((err, req, res, next) => {
    console.error('❌ Ошибка сервера:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Внутренняя ошибка сервера'
    });
});

// === ЗАПУСК ===
app.listen(PORT, async () => {
    console.log('='.repeat(50));
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('='.repeat(50));
    
    try {
        await db.initializeDatabase();
        console.log('✅ Инициализация завершена');
        console.log(`📊 Режим: ${db.isConnected() ? 'База данных' : 'Память (сессионный)'}`);
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error.message);
    }
});

module.exports = app;
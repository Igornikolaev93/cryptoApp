const express = require('express');
const cors = require('cors');
const db = require('./db');
const authRoutes = require('./routes/auth');
const operationRoutes = require('./routes/operations');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

console.log('🚀 Запуск сервера...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅' : '❌');

// CORS
app.use(cors({
    origin: ['https://igornikolaev93.github.io', 'https://crypto-backend.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
    credentials: true
}));

app.use(express.json());

// Маршруты
app.get('/', (req, res) => {
    res.json({
        message: '🚀 CryptoApp Backend API',
        status: 'online',
        version: '1.0.0',
        server_time: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', server: 'running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/operations', operationRoutes);

// 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Маршрут не найден',
        path: req.originalUrl
    });
});

// Экспорт для Vercel (ОБЯЗАТЕЛЬНО!)
module.exports = app;
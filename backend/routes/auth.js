// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
    console.log('📝 Регистрация нового пользователя');
    console.log('📋 Данные:', req.body);
    
    try {
        const { username, email, password } = req.body;

        // Валидация
        if (!username || !email || !password) {
            console.log('❌ Ошибка: не все поля заполнены');
            return res.status(400).json({
                success: false,
                message: 'Все поля обязательны для заполнения'
            });
        }

        // Проверяем подключение к БД
        if (!db.isConnected()) {
            console.log('❌ БД не подключена, пробуем переподключиться...');
            await db.initializeDatabase();
            
            if (!db.isConnected()) {
                return res.status(503).json({
                    success: false,
                    message: 'База данных временно недоступна'
                });
            }
        }

        // Проверяем существование пользователя
        console.log('🔍 Проверка существования пользователя...');
        const existingUser = await db.query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            console.log('❌ Пользователь уже существует');
            return res.status(400).json({
                success: false,
                message: 'Пользователь с таким email или именем уже существует'
            });
        }

        // Хешируем пароль
        console.log('🔐 Хеширование пароля...');
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Создаем пользователя
        console.log('💾 Сохранение пользователя в БД...');
        const result = await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, password_hash]
        );

        console.log(`✅ Пользователь создан с ID: ${result.rows.insertId}`);

        res.status(201).json({
            success: true,
            message: 'Пользователь успешно зарегистрирован',
            user_id: result.rows.insertId
        });

    } catch (error) {
        console.error('❌ ОШИБКА РЕГИСТРАЦИИ:', error);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при регистрации',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Внутренняя ошибка сервера'
        });
    }
});

// Логин
router.post('/login', async (req, res) => {
    console.log('🔑 Попытка входа');
    console.log('📋 Email:', req.body.email);
    
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email и пароль обязательны'
            });
        }

        const userResult = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (userResult.rows.length === 0) {
            console.log('❌ Пользователь не найден');
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }

        const user = userResult.rows[0];
        console.log(`👤 Найден пользователь: ${user.username}`);

        // Проверяем пароль
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.log('❌ Неверный пароль');
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }

        // Создаем JWT
        const token = jwt.sign(
            { user_id: user.user_id, username: user.username },
            process.env.JWT_SECRET || 'default_secret_key_change_me',
            { expiresIn: '7d' }
        );

        console.log(`✅ Вход выполнен: ${user.username}`);

        res.json({
            success: true,
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при входе'
        });
    }
});

// Получение информации о пользователе
router.get('/user', async (req, res) => {
    try {
        const token = req.header('x-auth-token');
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Нет токена авторизации'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key_change_me');
        
        const userResult = await db.query(
            'SELECT user_id, username, email, created_at FROM users WHERE user_id = ?',
            [decoded.user_id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }

        res.json({
            success: true,
            user: userResult.rows[0]
        });

    } catch (error) {
        console.error('❌ Ошибка получения пользователя:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Недействительный токен'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

module.exports = router;
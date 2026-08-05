const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// === РЕГИСТРАЦИЯ ===
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, full_name, phone } = req.body;
        
        console.log('📝 Попытка регистрации:', { username, email });

        // Проверяем, есть ли пользователь
        const existingUser = await db.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Пользователь с таким email или именем уже существует'
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await db.query(
            `INSERT INTO users (username, email, hashed_password, full_name, phone) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email`,
            [username, email, hashedPassword, full_name || null, phone || null]
        );
        
        // Создаем сессию
        const token = jwt.sign(
            { id: result.rows[0].id, email: result.rows[0].email },
            process.env.JWT_SECRET || 'session_secret_key',
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            success: true,
            message: 'Регистрация прошла успешно',
            user: result.rows[0],
            token
        });
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error.message);
        res.status(500).json({
            success: false,
            message: 'Ошибка регистрации'
        });
    }
});

// === ВХОД ===
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔑 Попытка входа:', { email });

        const userResult = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }
        
        const user = userResult.rows[0];
        
        const isValidPassword = await bcrypt.compare(password, user.hashed_password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'session_secret_key',
            { expiresIn: '7d' }
        );
        
        // Обновляем время входа
        await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                is_verified: user.is_verified
            }
        });
    } catch (error) {
        console.error('❌ Ошибка входа:', error.message);
        res.status(500).json({
            success: false,
            message: 'Ошибка входа'
        });
    }
});

// === ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ===
router.get('/me', async (req, res) => {
    try {
        const token = req.headers['x-auth-token'];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Токен не предоставлен'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'session_secret_key');
        const userResult = await db.query(
            'SELECT id, username, email, full_name, phone, is_verified, created_at FROM users WHERE id = $1',
            [decoded.id]
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
        console.error('❌ Ошибка получения пользователя:', error.message);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения данных пользователя'
        });
    }
});

// === ВЫХОД (локально) ===
router.post('/logout', async (req, res) => {
    try {
        // Клиент сам удаляет токен
        res.json({
            success: true,
            message: 'Выход выполнен'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Ошибка выхода'
        });
    }
});

// === ПОЛУЧЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ (для отладки) ===
router.get('/users', async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, email, full_name, created_at FROM users');
        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Ошибка получения пользователей'
        });
    }
});

module.exports = router;
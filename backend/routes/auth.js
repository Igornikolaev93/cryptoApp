// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Проверяем существование пользователя
        const existingUser = await db.query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Пользователь с таким email или именем уже существует' 
            });
        }

        // Хешируем пароль
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Создаем пользователя
        const result = await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, password_hash]
        );

        res.status(201).json({
            success: true,
            message: 'Пользователь успешно зарегистрирован',
            user_id: result.rows.insertId
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Логин
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const userResult = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }

        const user = userResult.rows[0];

        // Проверяем пароль
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }

        // Создаем JWT
        const token = jwt.sign(
            { user_id: user.user_id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

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
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
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

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
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
        console.error('Get user error:', error);
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
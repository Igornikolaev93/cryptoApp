const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Регистрация
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, full_name, phone } = req.body;
        
        // Проверка существования пользователя
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
        
        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Создание пользователя
        const result = await db.query(
            `INSERT INTO users (username, email, hashed_password, full_name, phone) 
             VALUES (?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, full_name || null, phone || null]
        );
        
        res.status(201).json({
            success: true,
            message: 'Регистрация прошла успешно',
            user: {
                id: result.rows.insertId,
                username,
                email
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка регистрации'
        });
    }
});

// Вход
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Поиск пользователя
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
        
        // Проверка пароля
        const isValidPassword = await bcrypt.compare(password, user.hashed_password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }
        
        // Создание JWT токена
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '7d' }
        );
        
        // Обновление времени последнего входа
        await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
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
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка входа'
        });
    }
});

// Получение информации о пользователе
router.get('/me', async (req, res) => {
    try {
        const token = req.headers['x-auth-token'];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Токен не предоставлен'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        const userResult = await db.query(
            'SELECT id, username, email, full_name, phone, is_verified, created_at FROM users WHERE id = ?',
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
        console.error('Get user error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Недействительный токен'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Ошибка получения данных пользователя'
        });
    }
});

module.exports = router;
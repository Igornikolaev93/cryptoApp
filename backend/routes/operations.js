// backend/routes/operations.js
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// Middleware для проверки токена
const auth = async (req, res, next) => {
    try {
        const token = req.header('x-auth-token');
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Нет токена авторизации'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Недействительный токен'
        });
    }
};

// Создание операции
router.post('/', auth, async (req, res) => {
    try {
        const {
            operation_type,
            crypto_currency,
            crypto_amount,
            fiat_currency,
            fiat_amount,
            payment_method,
            wallet_address,
            status = 'pending'
        } = req.body;

        const result = await db.query(
            `INSERT INTO operations (
                user_id, operation_type, crypto_currency, crypto_amount,
                fiat_currency, fiat_amount, payment_method, wallet_address, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.user_id,
                operation_type,
                crypto_currency,
                crypto_amount,
                fiat_currency,
                fiat_amount,
                payment_method,
                wallet_address,
                status
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Операция создана',
            operation_id: result.rows.insertId
        });

    } catch (error) {
        console.error('Create operation error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка создания операции'
        });
    }
});

// Получение всех операций пользователя
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM operations WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.user_id]
        );

        res.json({
            success: true,
            operations: result.rows,
            count: result.rowCount
        });

    } catch (error) {
        console.error('Get operations error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения операций'
        });
    }
});

// Получение одной операции
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM operations WHERE operation_id = ? AND user_id = ?',
            [req.params.id, req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Операция не найдена'
            });
        }

        res.json({
            success: true,
            operation: result.rows[0]
        });

    } catch (error) {
        console.error('Get operation error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения операции'
        });
    }
});

// Обновление статуса операции
router.put('/:id', auth, async (req, res) => {
    try {
        const { status } = req.body;

        const result = await db.query(
            'UPDATE operations SET status = ? WHERE operation_id = ? AND user_id = ?',
            [status, req.params.id, req.user.user_id]
        );

        if (result.rows.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Операция не найдена'
            });
        }

        res.json({
            success: true,
            message: 'Статус операции обновлен'
        });

    } catch (error) {
        console.error('Update operation error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка обновления операции'
        });
    }
});

module.exports = router;
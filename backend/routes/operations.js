const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Создание операции (требуется аутентификация)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const {
            operation_type,
            crypto_currency,
            crypto_amount,
            fiat_currency,
            fiat_amount,
            payment_method,
            wallet_address,
            notes
        } = req.body;
        
        const userId = req.user.id;
        
        // Валидация
        if (!operation_type || !crypto_currency || !crypto_amount || !fiat_currency || !fiat_amount) {
            return res.status(400).json({
                success: false,
                message: 'Все поля обязательны для заполнения'
            });
        }
        
        // Расчет комиссии (1%)
        const fee = fiat_amount * 0.01;
        
        const result = await db.query(
            `INSERT INTO operations (
                user_id, operation_type, crypto_currency, crypto_amount,
                fiat_currency, fiat_amount, fee, payment_method,
                wallet_address, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                operation_type,
                crypto_currency,
                crypto_amount,
                fiat_currency,
                fiat_amount,
                fee,
                payment_method || null,
                wallet_address || null,
                'pending',
                notes || null
            ]
        );
        
        res.status(201).json({
            success: true,
            message: 'Операция создана',
            operationId: result.rows.insertId
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
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, limit = 50, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM operations WHERE user_id = ?';
        const params = [userId];
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await db.query(query, params);
        
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

// Получение конкретной операции
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const operationId = req.params.id;
        
        const result = await db.query(
            'SELECT * FROM operations WHERE id = ? AND user_id = ?',
            [operationId, userId]
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

// Отмена операции
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const operationId = req.params.id;
        
        // Проверка, что операция существует и принадлежит пользователю
        const checkResult = await db.query(
            'SELECT status FROM operations WHERE id = ? AND user_id = ?',
            [operationId, userId]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Операция не найдена'
            });
        }
        
        if (checkResult.rows[0].status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Невозможно отменить операцию в текущем статусе'
            });
        }
        
        await db.query(
            'UPDATE operations SET status = "cancelled" WHERE id = ? AND user_id = ?',
            [operationId, userId]
        );
        
        res.json({
            success: true,
            message: 'Операция отменена'
        });
    } catch (error) {
        console.error('Cancel operation error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка отмены операции'
        });
    }
});

module.exports = router;
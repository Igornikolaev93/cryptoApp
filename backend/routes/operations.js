const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Создание операции
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
        
        if (!operation_type || !crypto_currency || !crypto_amount || !fiat_currency || !fiat_amount) {
            return res.status(400).json({
                success: false,
                message: 'Все поля обязательны для заполнения'
            });
        }
        
        const fee = fiat_amount * 0.01;
        
        // PostgreSQL RETURNING вместо insertId
        const result = await db.query(
            `INSERT INTO operations (
                user_id, operation_type, crypto_currency, crypto_amount,
                fiat_currency, fiat_amount, fee_amount, fee_currency,
                payment_method, wallet_address, status, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id`,
            [
                userId,
                operation_type,
                crypto_currency,
                crypto_amount,
                fiat_currency,
                fiat_amount,
                fee,
                fiat_currency,
                payment_method || null,
                wallet_address || null,
                'pending',
                notes || null
            ]
        );
        
        res.status(201).json({
            success: true,
            message: 'Операция создана',
            operationId: result.rows[0].id
        });
    } catch (error) {
        console.error('Create operation error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Ошибка создания операции'
        });
    }
});

// Получение операций пользователя
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, limit = 50, offset = 0 } = req.query;
        
        let queryText = 'SELECT * FROM operations WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;
        
        if (status) {
            queryText += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        
        queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await db.query(queryText, params);
        
        res.json({
            success: true,
            operations: result.rows,
            count: result.rowCount
        });
    } catch (error) {
        console.error('Get operations error:', error.message);
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
            'SELECT * FROM operations WHERE id = $1 AND user_id = $2',
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
        console.error('Get operation error:', error.message);
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
        
        const checkResult = await db.query(
            'SELECT status FROM operations WHERE id = $1 AND user_id = $2',
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
            'UPDATE operations SET status = $1 WHERE id = $2 AND user_id = $3',
            ['cancelled', operationId, userId]
        );
        
        res.json({
            success: true,
            message: 'Операция отменена'
        });
    } catch (error) {
        console.error('Cancel operation error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Ошибка отмены операции'
        });
    }
});

module.exports = router;
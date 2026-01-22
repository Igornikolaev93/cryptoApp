// backend/routes/operations.js
const express = require('express');
const router = express.Router();
const { query } = require('../db'); // Изменено
const auth = require('../middleware/auth');

// Создание новой операции
router.post('/', auth, async (req, res) => {
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
  
  const userId = req.user.userId;

  // Валидация
  if (!operation_type || !crypto_currency || !crypto_amount) {
    return res.status(400).json({ 
      error: 'Тип операции, криптовалюта и сумма обязательны' 
    });
  }

  try {
    const newOperation = await query(
      `INSERT INTO operations (
        user_id, operation_type, crypto_currency, crypto_amount, 
        fiat_currency, fiat_amount, payment_method, wallet_address, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, operation_type, crypto_currency, crypto_amount, 
       fiat_currency, fiat_amount, payment_method, wallet_address, status]
    );

    res.json({
      success: true,
      message: 'Операция успешно создана',
      operation: newOperation.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка создания операции:', err.message);
    
    // Специфичные ошибки базы данных
    if (err.message.includes('База данных спит') || err.message.includes('не подключена')) {
      return res.status(503).json({ 
        error: 'База данных спит. Пожалуйста, попробуйте снова через 30 секунд.' 
      });
    }
    
    res.status(500).json({ error: 'Ошибка сервера при создании операции' });
  }
});

// Получение всех операций пользователя
router.get('/', auth, async (req, res) => {
  const userId = req.user.userId;

  try {
    const operations = await query(
      'SELECT * FROM operations WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      count: operations.rows.length,
      operations: operations.rows,
      summary: {
        total_operations: operations.rows.length,
        by_type: operations.rows.reduce((acc, op) => {
          acc[op.operation_type] = (acc[op.operation_type] || 0) + 1;
          return acc;
        }, {}),
        by_status: operations.rows.reduce((acc, op) => {
          acc[op.status] = (acc[op.status] || 0) + 1;
          return acc;
        }, {})
      }
    });
  } catch (err) {
    console.error('❌ Ошибка получения операций:', err.message);
    
    // Специфичные ошибки базы данных
    if (err.message.includes('База данных спит') || err.message.includes('не подключена')) {
      return res.status(503).json({ 
        error: 'База данных спит. Пожалуйста, попробуйте снова через 30 секунд.' 
      });
    }
    
    res.status(500).json({ error: 'Ошибка сервера при получении операций' });
  }
});

// Получение конкретной операции
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const operation = await query(
      'SELECT * FROM operations WHERE operation_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (operation.rows.length === 0) {
      return res.status(404).json({ error: 'Операция не найдена' });
    }

    res.json({
      success: true,
      operation: operation.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка получения операции:', err.message);
    
    // Специфичные ошибки базы данных
    if (err.message.includes('База данных спит') || err.message.includes('не подключена')) {
      return res.status(503).json({ 
        error: 'База данных спит. Пожалуйста, попробуйте снова через 30 секунд.' 
      });
    }
    
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновление операции
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const updates = req.body;

  try {
    // Проверяем существование операции
    const operationExists = await query(
      'SELECT * FROM operations WHERE operation_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (operationExists.rows.length === 0) {
      return res.status(404).json({ error: 'Операция не найдена' });
    }

    // Создаем динамический запрос на обновление
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 3}`)
      .join(', ');
    
    const values = Object.values(updates);
    
    const updatedOperation = await query(
      `UPDATE operations 
       SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE operation_id = $1 AND user_id = $2 
       RETURNING *`,
      [id, userId, ...values]
    );

    res.json({
      success: true,
      message: 'Операция успешно обновлена',
      operation: updatedOperation.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка обновления операции:', err.message);
    
    // Специфичные ошибки базы данных
    if (err.message.includes('База данных спит') || err.message.includes('не подключена')) {
      return res.status(503).json({ 
        error: 'База данных спит. Пожалуйста, попробуйте снова через 30 секунд.' 
      });
    }
    
    res.status(500).json({ error: 'Ошибка сервера при обновлении операции' });
  }
});

// Удаление операции
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const deletedOperation = await query(
      'DELETE FROM operations WHERE operation_id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (deletedOperation.rows.length === 0) {
      return res.status(404).json({ error: 'Операция не найдена' });
    }

    res.json({
      success: true,
      message: 'Операция успешно удалена',
      operation: deletedOperation.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка удаления операции:', err.message);
    
    // Специфичные ошибки базы данных
    if (err.message.includes('База данных спит') || err.message.includes('не подключена')) {
      return res.status(503).json({ 
        error: 'База данных спит. Пожалуйста, попробуйте снова через 30 секунд.' 
      });
    }
    
    res.status(500).json({ error: 'Ошибка сервера при удалении операции' });
  }
});

module.exports = router;
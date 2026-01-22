// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const { query } = require('../db'); // Изменено
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
require('dotenv').config();

// Регистрация пользователя
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Валидация
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
  }

  try {
    // Проверка существования пользователя
    const userExists = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Хеширование пароля
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Создание пользователя
    const newUser = await query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [username, email, passwordHash]
    );

    // Создание JWT токена
    const token = jwt.sign(
      { userId: newUser.rows[0].user_id },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Пользователь успешно зарегистрирован',
      user: {
        user_id: newUser.rows[0].user_id,
        username: newUser.rows[0].username,
        email: newUser.rows[0].email
      },
      token
    });
  } catch (err) {
    console.error('❌ Ошибка регистрации:', err.message);
    
    // Специфичные ошибки базы данных
    if (err.message.includes('База данных спит') || err.message.includes('не подключена')) {
      return res.status(503).json({ 
        error: 'База данных спит. Пожалуйста, попробуйте снова через 30 секунд.' 
      });
    }
    
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Авторизация пользователя
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Валидация
  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  try {
    // Поиск пользователя
    const user = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (user.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    // Проверка пароля
    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);

    if (!validPassword) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    // Создание JWT токена
    const token = jwt.sign(
      { userId: user.rows[0].user_id },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Авторизация успешна',
      user: {
        user_id: user.rows[0].user_id,
        username: user.rows[0].username,
        email: user.rows[0].email
      },
      token
    });
  } catch (err) {
    console.error('❌ Ошибка авторизации:', err.message);
    
    // Специфичные ошибки базы данных
    if (err.message.includes('База данных спит') || err.message.includes('не подключена')) {
      return res.status(503).json({ 
        error: 'База данных спит. Пожалуйста, попробуйте снова через 30 секунд.' 
      });
    }
    
    res.status(500).json({ error: 'Ошибка сервера при авторизации' });
  }
});

// Получение данных пользователя
router.get('/user', auth, async (req, res) => {
  try {
    const user = await query(
      'SELECT user_id, username, email, created_at FROM users WHERE user_id = $1',
      [req.user.userId]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      success: true,
      user: user.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка получения данных пользователя:', err.message);
    
    // Специфичные ошибки базы данных
    if (err.message.includes('База данных спит') || err.message.includes('не подключена')) {
      return res.status(503).json({ 
        error: 'База данных спит. Пожалуйста, попробуйте снова через 30 секунд.' 
      });
    }
    
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
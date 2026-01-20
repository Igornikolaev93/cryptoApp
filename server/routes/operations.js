const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');



router.post('/', auth, async (req, res) => {
  const { operation_type, crypto_currency, crypto_amount, fiat_currency, fiat_amount, payment_method, wallet_address, status } = req.body;
  const userId = req.user.userId;

  try {
    const newOperation = await pool.query(
      'INSERT INTO operations (user_id, operation_type, crypto_currency, crypto_amount, fiat_currency, fiat_amount, payment_method, wallet_address, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [userId, operation_type, crypto_currency, crypto_amount, fiat_currency, fiat_amount, payment_method, wallet_address, status]
    );

    res.json(newOperation.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


router.get('/', auth, async (req, res) => {
  const userId = req.user.userId;

  try {
    const operations = await pool.query('SELECT * FROM operations WHERE user_id = $1', [userId]);
    res.json(operations.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
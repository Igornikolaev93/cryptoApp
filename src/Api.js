import React, { useEffect, useState, useRef } from 'react';
import api from './services/api'; // Импортируем наш API клиент
import './App.css';
import UserProfile from './UserProfile';

// API_URL теперь берется из api.js
// const API_URL = ... убираем отсюда

function App() {
  // ... остальной код

  // В handleLogin:
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', loginData); // Убрали API_URL
      localStorage.setItem('token', res.data.token);
      
      const userRes = await api.get('/auth/user');
      setUser(userRes.data);

      setShowLoginModal(false);
      openProfile();
    } catch (error) {
      console.error('Login failed:', error);
      alert('Неверный email или пароль');
    }
  };

  // В handleRegister:
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', registerData); // Убрали API_URL
      alert('Регистрация прошла успешно!');
      setShowRegisterModal(false);
      setShowLoginModal(true);
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Ошибка регистрации');
    }
  };

  // В handleWithdrawalSubmit:
  const handleWithdrawalSubmit = async (e) => {
    e.preventDefault();
    // ... проверки
    try {
      const operationData = {
        operation_type: 'sell',
        crypto_currency: selectedCrypto.symbol,
        crypto_amount: cryptoAmount,
        fiat_currency: selectedFiat,
        fiat_amount: fiatAmount,
        payment_method: withdrawalData.paymentMethod,
        wallet_address: withdrawalData.walletAddress,
        status: 'pending'
      };

      await api.post('/operations', operationData); // Убрали API_URL и headers

      alert(`Заявка на вывод успешно создана!`);
      setShowWithdrawalModal(false);
      // ...
    } catch (error) {
      console.error('Error creating operation:', error);
      alert('Ошибка при создании операции');
    }
  };

  // В openProfile:
  const openProfile = async () => {
    try {
      const res = await api.get('/operations'); // Убрали API_URL
      setUserOperations(res.data);
      setShowProfileModal(true);
    } catch (error) {
      console.error('Error fetching operations:', error);
    }
  };

  // ... остальной код
}
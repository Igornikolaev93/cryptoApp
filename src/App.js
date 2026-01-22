
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import './App.css';
import UserProfile from './UserProfile';

const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://cryptoapp-backend.onrender.com' 
  : 'http://localhost:5000';

function App() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [user, setUser] = useState(null);
  const [userOperations, setUserOperations] = useState([]);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' });

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const [selectedCrypto, setSelectedCrypto] = useState({
    symbol: 'BTC',
    name: 'Bitcoin',
    price: ''
  });

  const [cryptoAmount, setCryptoAmount] = useState(1.0);
  const [fiatAmount, setFiatAmount] = useState(0);
  const [selectedFiat, setSelectedFiat] = useState('USD');

  const [withdrawalData, setWithdrawalData] = useState({
    paymentMethod: 'bank_card',
    walletAddress: '',
    email: '',
    phone: '',
    fullName: ''
  });

  const cryptoOptions = [
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'USDT', name: 'Tether' },
    { symbol: 'BNB', name: 'Binance Coin' },
    { symbol: 'XRP', name: 'Ripple' }
  ];

  const fiatOptions = ['USD', 'EUR', 'RUB', 'UAH', 'KZT'];

  const paymentMethods = [
    { id: 'bank_card', name: 'Банковская карта', icon: '💳' },
    { id: 'bank_transfer', name: 'Банковский перевод', icon: '🏦' },
    { id: 'paypal', name: 'PayPal', icon: '🔵' },
    { id: 'yoomoney', name: 'ЮMoney', icon: '💰' },
    { id: 'qiwi', name: 'QIWI', icon: '🟠' }
  ];

  const lastScrollPosition = useRef(0);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['x-auth-token'] = token;
      // You can add a request here to get user data if needed
    }

    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        setCoins(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        setError(error.message);
        setLoading(false);
      });

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  const handleScroll = () => {
    if (!isScrolling.current) {
      isScrolling.current = true;
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = setTimeout(() => {
        const currentScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        const scrollDifference = Math.abs(currentScrollPosition - lastScrollPosition.current);
        if (scrollDifference > 100) {
          resetInputValues();
          lastScrollPosition.current = currentScrollPosition;
        }
        isScrolling.current = false;
      }, 150);
    }
  };

  const resetInputValues = () => {
    setCryptoAmount(1.0);
    const calculatedFiatAmount = selectedCrypto.price * 1.0;
    setFiatAmount(calculatedFiatAmount);
  };

  const handleBuy = (coin) => {
    const selected = cryptoOptions.find(c => c.symbol.toLowerCase() === coin.symbol.toLowerCase()) ||
      { symbol: coin.symbol.toUpperCase(), name: coin.name };
    setSelectedCrypto({
      symbol: selected.symbol,
      name: selected.name,
      price: coin.current_price
    });
    setCryptoAmount(1.0);
    const calculatedFiatAmount = coin.current_price * 1.0;
    setFiatAmount(calculatedFiatAmount);
    const exchangeSection = document.querySelector('.converter-section');
    if (exchangeSection) {
      exchangeSection.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        lastScrollPosition.current = window.pageYOffset || document.documentElement.scrollTop;
      }, 300);
    }
  };

  const handleCryptoAmountChange = (e) => {
    const amount = parseFloat(e.target.value);
    setCryptoAmount(amount);
    const calculatedFiatAmount = selectedCrypto.price * amount;
    setFiatAmount(calculatedFiatAmount);
  };

  const handleCryptoChange = (e) => {
    const symbol = e.target.value;
    const selected = cryptoOptions.find(c => c.symbol === symbol);
    if (selected) {
      const coinData = coins.find(c => c.symbol.toLowerCase() === symbol.toLowerCase());
      const price = coinData ? coinData.current_price : selectedCrypto.price;
      setSelectedCrypto({
        symbol: selected.symbol,
        name: selected.name,
        price: price
      });
      setCryptoAmount(1.0);
      const calculatedFiatAmount = price * 1.0;
      setFiatAmount(calculatedFiatAmount);
    }
  };

  const handleFiatChange = (e) => {
    setSelectedFiat(e.target.value);
  };

  const handleSwapCurrencies = () => {
    alert('Функция обмена валют местами в разработке');
  };

  const handleExchange = () => {
    setShowWithdrawalModal(true);
  };

  const handleReset = () => {
    resetInputValues();
    alert('Значения сброшены');
  };

  const handleWithdrawalChange = (e) => {
    const { name, value } = e.target;
    setWithdrawalData(prev => ({ ...prev, [name]: value }));
  };

  const handlePaymentMethodChange = (methodId) => {
    setWithdrawalData(prev => ({ ...prev, paymentMethod: methodId, walletAddress: '' }));
  };

  const handleWithdrawalSubmit = async (e) => {
    e.preventDefault();
    if (!withdrawalData.walletAddress.trim() || !withdrawalData.fullName.trim()) {
      alert('Пожалуйста, введите все обязательные поля');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Пожалуйста, войдите в систему, чтобы совершить операцию');
      return;
    }

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

      await axios.post(`${API_URL}/api/operations`, operationData, {
        headers: { 'x-auth-token': token }
      });

      alert(`Заявка на вывод ${cryptoAmount} ${selectedCrypto.symbol} успешно создана!`);
      setShowWithdrawalModal(false);
      setWithdrawalData({ paymentMethod: 'bank_card', walletAddress: '', email: '', phone: '', fullName: '' });
      resetInputValues();
    } catch (error) {
      console.error('Error creating operation:', error);
      alert('Ошибка при создании операции');
    }
  };

  const closeWithdrawalModal = () => {
    setShowWithdrawalModal(false);
  };

  const getWalletPlaceholder = () => {
    switch (withdrawalData.paymentMethod) {
      case 'bank_card': return 'Номер банковской карты';
      case 'bank_transfer': return 'Реквизиты банковского счета';
      case 'paypal': return 'Email PayPal';
      case 'yoomoney': return 'Номер кошелька ЮMoney';
      case 'qiwi': return 'Номер QIWI кошелька';
      default: return 'Введите реквизиты';
    }
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, loginData);
      localStorage.setItem('token', res.data.token);
      axios.defaults.headers.common['x-auth-token'] = res.data.token;
      
      // Fetch user data
      const userRes = await axios.get(`${API_URL}/api/auth/user`);
      setUser(userRes.data);

      setShowLoginModal(false);
      openProfile();
    } catch (error) {
      console.error('Login failed:', error);
      alert('Неверный email или пароль');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/auth/register`, registerData);
      alert('Регистрация прошла успешно! Теперь вы можете войти в систему.');
      setShowRegisterModal(false);
      setShowLoginModal(true);
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Ошибка регистрации');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['x-auth-token'];
    setUser(null);
    setUserOperations([]);
    setShowProfileModal(false);
  };

  const openProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/operations`);
      setUserOperations(res.data);
      setShowProfileModal(true);
    } catch (error) {
      console.error('Error fetching operations:', error);
    }
  };

  return (
    <div className="App">
      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay">
          <div className="modal-content">            
            <div className="modal-header">
              <h2>Вход</h2>
              <button className="modal-close" onClick={() => setShowLoginModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleLogin}>
                <input type="email" name="email" placeholder="Email" value={loginData.email} onChange={handleLoginChange} required />
                <input type="password" name="password" placeholder="Пароль" value={loginData.password} onChange={handleLoginChange} required />
                <button type="submit" className="btn btn-primary">Войти</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="modal-overlay">
          <div className="modal-content">            
            <div className="modal-header">
              <h2>Регистрация</h2>
              <button className="modal-close" onClick={() => setShowRegisterModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleRegister}>
                <input type="text" name="username" placeholder="Имя пользователя" value={registerData.username} onChange={handleRegisterChange} required />
                <input type="email" name="email" placeholder="Email" value={registerData.email} onChange={handleRegisterChange} required />
                <input type="password" name="password" placeholder="Пароль" value={registerData.password} onChange={handleRegisterChange} required />
                <button type="submit" className="btn btn-primary">Зарегистрироваться</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content user-profile-modal">
            <div className="modal-header">
              <h2>Личный кабинет</h2>
              <button className="modal-close" onClick={() => setShowProfileModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <UserProfile user={user} operations={userOperations} onLogout={handleLogout} />
            </div>
          </div>
        </div>
      )}

      {showWithdrawalModal && (
        <div className="modal-overlay">
          <div className="modal-content withdrawal-modal">
            <div className="modal-header">
              <h2>Вывод средств от продажи криптовалюты</h2>
              <button className="modal-close" onClick={closeWithdrawalModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="exchange-summary">
                <h3>Детали обмена</h3>
                <div className="summary-details">
                  <div className="summary-item"><span>Продаете:</span><strong>{cryptoAmount} {selectedCrypto.symbol}</strong></div>
                  <div className="summary-item"><span>Получаете:</span><strong>{fiatAmount.toFixed(2)} {selectedFiat}</strong></div>
                  <div className="summary-item"><span>Курс:</span><strong>1 {selectedCrypto.symbol} = {selectedCrypto.price.toLocaleString()} USD</strong></div>
                </div>
              </div>
              <form className="withdrawal-form" onSubmit={handleWithdrawalSubmit}>
                <div className="form-section">
                  <h3>Данные для вывода</h3>
                  <div className="form-group"><label>ФИО получателя *</label><input type="text" name="fullName" value={withdrawalData.fullName} onChange={handleWithdrawalChange} placeholder="Иванов Иван Иванович" required /></div>
                  <div className="form-group"><label>Email</label><input type="email" name="email" value={withdrawalData.email} onChange={handleWithdrawalChange} placeholder="example@email.com" /></div>
                  <div className="form-group"><label>Телефон</label><input type="tel" name="phone" value={withdrawalData.phone} onChange={handleWithdrawalChange} placeholder="+7 (999) 123-45-67" /></div>
                </div>
                <div className="form-section">
                  <h3>Способ получения средств</h3>
                  <div className="payment-methods">
                    {paymentMethods.map(method => (
                      <div key={method.id} className={`payment-method ${withdrawalData.paymentMethod === method.id ? 'active' : ''}`} onClick={() => handlePaymentMethodChange(method.id)}>
                        <div className="payment-icon">{method.icon}</div>
                        <div className="payment-name">{method.name}</div>
                      </div>
                    ))}
                  </div>
                  <div className="form-group">
                    <label>Реквизиты для получения *</label>
                    <input type="text" name="walletAddress" value={withdrawalData.walletAddress} onChange={handleWithdrawalChange} placeholder={getWalletPlaceholder()} required />
                    <small className="form-hint">{withdrawalData.paymentMethod === 'bank_card' ? 'Укажите номер карты без пробелов' : 'Введите корректные реквизиты'}</small>
                  </div>
                </div>
                <div className="form-section">
                  <h3>Сводка</h3>
                  <div className="withdrawal-summary">
                    <div className="summary-row"><span>Сумма вывода:</span><span>{fiatAmount.toFixed(2)} {selectedFiat}</span></div>
                    <div className="summary-row"><span>Комиссия сервиса:</span><span>{(fiatAmount * 0.01).toFixed(2)} {selectedFiat} (1%)</span></div>
                    <div className="summary-row total"><span>Итого к получению:</span><span>{(fiatAmount * 0.99).toFixed(2)} {selectedFiat}</span></div>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-outline" onClick={closeWithdrawalModal}>Отмена</button>
                  <button type="submit" className="btn btn-primary">Подтвердить вывод</button>
                </div>
                <div className="form-disclaimer"><p>⚠️ Средства будут переведены в течение 1-24 часов после подтверждения операции.</p><p>🔒 Ваши данные защищены и используются только для обработки транзакции.</p></div>
              </form>
            </div>
          </div>
        </div>
      )}

      <header>
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <div className="logo-icon">C</div>
              <span>CryptoExchange</span>
            </div>
            <button className="mobile-menu-btn">☰</button>
            <nav>
              <ul>
                <li><a href="#">Главная</a></li>
                <li><a href="#">Обмен</a></li>
                <li><a href="#">Курсы</a></li>
                <li><a href="#">О нас</a></li>
                <li><a href="#">Контакты</a></li>
              </ul>
            </nav>
            <div className="auth-buttons">
              {user ? (
                <>
                  <button className="btn btn-outline" onClick={openProfile}>Профиль</button>
                  <button className="btn btn-primary" onClick={handleLogout}>Выйти</button>
                </>
              ) : (
                <>
                  <button className="btn btn-outline" onClick={() => setShowLoginModal(true)}>Войти</button>
                  <button className="btn btn-primary" onClick={() => setShowRegisterModal(true)}>Регистрация</button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ... rest of your component ... */}
            <section className="hero">
        <div className="container">
          <h1>Быстрый и безопасный обмен криптовалют</h1>
          <p>Мгновенные обмены по лучшим курсам с минимальными комиссиями. Более 100 криптовалют доступно для обмена.</p>
          <button className="btn btn-primary" onClick={toggleVisibility}>
            {isVisible ? 'Скрыть' : 'Начать обмен'}
          </button>
        </div>
      </section>

      <section className="container">
        <div className="converter-section" style={{ 
          display: isVisible ? 'block' : 'none' 
        }}>
          <h2 className="section-title">Обменяйте криптовалюту</h2>
          <div className="converter-controls">
            <button 
              className="btn btn-outline reset-btn" 
              onClick={handleReset}
              title="Сбросить значения"
            >
              ⟲ Сбросить
            </button>
          </div>
          <div className="converter">
            <div className="converter-item">
              <label className="converter-label">Отдаете</label>
              <div className="converter-input-group">
                <input 
                  type="number" 
                  className="converter-input" 
                  value={cryptoAmount}
                  min="0"
                  step="0.000001"
                  onChange={handleCryptoAmountChange}
                  placeholder="Введите количество"
                />
                <select 
                  className="converter-select"
                  value={selectedCrypto.symbol}
                  onChange={handleCryptoChange}
                >
                  {cryptoOptions.map(option => (
                    <option key={option.symbol} value={option.symbol}>
                      {option.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <div className="currency-info">
                {selectedCrypto.name} (Текущий курс: ${selectedCrypto.price.toLocaleString()})
              </div>
            </div>
            
            <button className="swap-btn" onClick={handleSwapCurrencies}>⇄</button>
            
            <div className="converter-item">
              <label className="converter-label">Получаете</label>
              <div className="converter-input-group">
                <input 
                  type="number" 
                  className="converter-input" 
                  value={fiatAmount.toFixed(2)} 
                  readOnly
                  placeholder="Будет рассчитано"
                />
                <select 
                  className="converter-select"
                  value={selectedFiat}
                  onChange={handleFiatChange}
                >
                  {fiatOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="converter-result">
            <p>Курс: 1 {selectedCrypto.symbol} = {selectedCrypto.price.toLocaleString()} USD</p>
            <p className="scroll-hint">💡 Значения будут сброшены при прокрутке страницы</p>
          </div>
          
          <button className="btn btn-primary exchange-btn" onClick={handleExchange}>
            Обменять {cryptoAmount} {selectedCrypto.symbol} на {fiatAmount.toFixed(2)} {selectedFiat}
          </button>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2 className="section-title">Почему выбирают нас</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3 className="feature-title">Быстрые транзакции</h3>
              <p>Среднее время обмена составляет менее 15 минут благодаря современным технологиям.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3 className="feature-title">Безопасность</h3>
              <p>Ваши средства защищены многоуровневой системой безопасности и холодным хранением.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">💎</div>
              <h3 className="feature-title">Низкие комиссии</h3>
              <p>Мы предлагаем одни из самых низких комиссий на рынке без скрытых платежей.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🌍</div>
              <h3 className="feature-title">Поддержка 24/7</h3>
              <p>Наша служба поддержки готова помочь вам в любое время суток на нескольких языках.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="popular-currencies">
        <div className="container">
          <h2 className="section-title">Популярные криптовалюты</h2>
          <div className="asset-list">
            {loading ? (
              <p>Загрузка...</p>
            ) : error ? (
              <p>Ошибка: {error}</p>
            ) : (
              coins.slice(0, 10).map(coin => (
                <div key={coin.id} className="asset">
                  <img src={coin.image} alt={coin.name} width="50" />
                  <h2>{coin.name} ({coin.symbol.toUpperCase()})</h2>
                  <p>Price: ${coin.current_price.toLocaleString()}</p>
                  <button onClick={() => handleBuy(coin)}>Купить</button>
                </div>
              ))
            )}
          </div>            
        </div>
      </section>

      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">Как это работает</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3 className="step-title">Выберите валюты</h3>
              <p>Укажите, какую криптовалюту вы хотите обменять и какую получить.</p>
            </div>
            
            <div className="step">
              <div className="step-number">2</div>
              <h3 className="step-title">Введите данные</h3>
              <p>Укажите сумму обмена и адрес кошелька для получения средств.</p>
            </div>
            
            <div className="step">
              <div className="step-number">3</div>
              <h3 className="step-title">Оплатите</h3>
              <p>Переведите криптовалюту на указанный адрес для обмена.</p>
            </div>
            
            <div className="step">
              <div className="step-number">4</div>
              <h3 className="step-title">Получите средства</h3>
              <p>После подтверждения транзакции вы получите средства на ваш кошелек.</p>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-content">
            <div className="footer-column">
              <h3>CryptoExchange</h3>
              <p>Быстрый и безопасный обмен криптовалют с 2025 года.</p>
            </div>
            
            <div className="footer-column">
              <h3>Услуги</h3>
              <ul>
                <li><a href="#">Обмен криптовалют</a></li>
                <li><a href="#">Курсы валют</a></li>
                <li><a href="#">Партнерская программа</a></li>
                <li><a href="#">API для разработчиков</a></li>
              </ul>
            </div>
            
            <div className="footer-column">
              <h3>Информация</h3>
              <ul>
                <li><a href="#">О нас</a></li>
                <li><a href="#">Политика конфиденциальности</a></li>
                <li><a href="#">Условия использования</a></li>
                <li><a href="#">Часто задаваемые вопросы</a></li>
              </ul>
            </div>
            
            <div className="footer-column">
              <h3>Контакты</h3>
              <ul>
                <li><a href="mailto:support@cryptoexchange.com">support@cryptoexchange.com</a></li>
                <li><a href="tel:+78001234567">8 (800) 123-45-67</a></li>
                <li>Поддержка 24/7</li>
              </ul>
            </div>
          </div>          
          <div className="footer-bottom">
            <p>&copy; 2025 CryptoExchange. Все права защищены.</p>
          </div>
        </div>
      </footer>      
    </div>
  );
}

export default App;

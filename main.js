 // Мобильное меню
        document.querySelector('.mobile-menu-btn').addEventListener('click', function() {
            document.querySelector('nav').classList.toggle('active');
        });

        // Конвертер валют (упрощенная версия)
        document.querySelector('.swap-btn').addEventListener('click', function() {
            const fromSelect = document.querySelector('.converter-item:first-child .converter-select');
            const toSelect = document.querySelector('.converter-item:last-child .converter-select');
            
            const temp = fromSelect.value;
            fromSelect.value = toSelect.value;
            toSelect.value = temp;
            
            // В реальном приложении здесь был бы запрос к API для получения нового курса
            updateExchangeRate();
        });

        // Обновление курса при изменении валют
        document.querySelectorAll('.converter-select').forEach(select => {
            select.addEventListener('change', updateExchangeRate);
        });

        // Функция обновления курса (заглушка)
        function updateExchangeRate() {
            const fromCurrency = document.querySelector('.converter-item:first-child .converter-select').value;
            const toCurrency = document.querySelector('.converter-item:last-child .converter-select').value;
            
            // В реальном приложении здесь был бы запрос к API
            const rates = {
                'BTC-USD': 54320.50,
                'ETH-USD': 3250.75,
                'USDT-USD': 1.00,
                'BTC-EUR': 50200.30,
                'ETH-EUR': 3000.20,
                'USDT-EUR': 0.92
            };
            
            const rateKey = `${fromCurrency}-${toCurrency}`;
            const rate = rates[rateKey] || 1.0;
            
            document.querySelector('.converter-result p').textContent = `Курс: 1 ${fromCurrency} = ${rate.toLocaleString()} ${toCurrency}`;
            
            // Обновляем значение получаемой суммы
            const fromAmount = document.querySelector('.converter-item:first-child .converter-input').value;
            document.querySelector('.converter-item:last-child .converter-input').value = (fromAmount * rate).toFixed(2);
        }

        // Обработчик изменения суммы
        document.querySelector('.converter-item:first-child .converter-input').addEventListener('input', function() {
            updateExchangeRate();
        });
    
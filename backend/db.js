const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;
let isDatabaseConnected = false;

async function initializeDatabase() {
    try {
        const databaseUrl = process.env.DATABASE_URL;
        
        console.log('🔧 Подключение к MySQL на Railway...');

        if (!databaseUrl) {
            throw new Error('DATABASE_URL не установлена');
        }

        pool = mysql.createPool({
            uri: databaseUrl,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 30000,
            ssl: {
                rejectUnauthorized: false
            }
        });

        const connection = await pool.getConnection();
        console.log('✅ Подключение к MySQL успешно!');
        
        const [rows] = await connection.query(
            'SELECT VERSION() as version, DATABASE() as database, USER() as user'
        );
        
        console.log(`📊 База данных: ${rows[0].database}`);
        console.log(`👤 Пользователь: ${rows[0].user}`);
        console.log(`📦 Версия MySQL: ${rows[0].version}`);
        
        connection.release();
        isDatabaseConnected = true;

        // ✅ АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ТАБЛИЦ
        await createTables();

        // Keep-alive
        setInterval(async () => {
            if (!isDatabaseConnected || !pool) return;
            try {
                const conn = await pool.getConnection();
                await conn.query('SELECT 1');
                conn.release();
                console.log('⏰ Keep-alive ping отправлен');
            } catch (error) {
                console.log('⚠️ Потеря связи с БД:', error.message);
                isDatabaseConnected = false;
                setTimeout(initializeDatabase, 10000);
            }
        }, 3 * 60 * 1000);

        return pool;
    } catch (error) {
        console.error('❌ Ошибка подключения к MySQL:', error.message);
        isDatabaseConnected = false;
        return null;
    }
}

// ✅ ФУНКЦИЯ ДЛЯ СОЗДАНИЯ ТАБЛИЦ
async function createTables() {
    try {
        console.log('📝 Проверка и создание таблиц...');

        // Таблица пользователей
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                hashed_password VARCHAR(200) NOT NULL,
                full_name VARCHAR(100),
                phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE,
                is_verified BOOLEAN DEFAULT FALSE,
                is_admin BOOLEAN DEFAULT FALSE,
                preferred_fiat VARCHAR(10) DEFAULT 'USD'
            )
        `);

        // Таблица операций
        await query(`
            CREATE TABLE IF NOT EXISTS operations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                operation_type ENUM('buy', 'sell', 'exchange') NOT NULL,
                crypto_currency VARCHAR(10) NOT NULL,
                crypto_amount DECIMAL(20,8) NOT NULL,
                fiat_currency VARCHAR(10) NOT NULL,
                fiat_amount DECIMAL(20,2) NOT NULL,
                exchange_rate DECIMAL(20,8),
                fee_amount DECIMAL(20,2) DEFAULT 0,
                fee_currency VARCHAR(10),
                payment_method VARCHAR(50),
                wallet_address VARCHAR(200),
                payment_details TEXT,
                status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
                transaction_hash VARCHAR(200),
                blockchain_confirmations INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL,
                notes TEXT,
                admin_notes TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Таблицы созданы или уже существуют');

        // Проверяем наличие таблиц
        const result = await query('SHOW TABLES');
        console.log(`📊 Найдено таблиц: ${result.rowCount}`);
        result.rows.forEach(row => {
            console.log(`  - ${Object.values(row)[0]}`);
        });

    } catch (error) {
        console.error('❌ Ошибка создания таблиц:', error.message);
    }
}

// Остальные функции query, isConnected, reconnect
async function query(sql, params = []) {
    if (!pool || !isDatabaseConnected) {
        console.log('⚠️ База данных не подключена, инициализация...');
        await initializeDatabase();
        if (!isDatabaseConnected) {
            throw new Error('База данных не подключена');
        }
    }

    try {
        const [rows] = await pool.query(sql, params);
        return { rows, rowCount: rows.length };
    } catch (error) {
        console.error('❌ Ошибка запроса:', error.message);
        if (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNRESET') {
            isDatabaseConnected = false;
            console.log('🔄 Переподключение к БД...');
            await initializeDatabase();
            const [rows] = await pool.query(sql, params);
            return { rows, rowCount: rows.length };
        }
        throw error;
    }
}

function isConnected() {
    return isDatabaseConnected;
}

async function reconnect() {
    isDatabaseConnected = false;
    if (pool) {
        try {
            await pool.end();
        } catch (e) {}
        pool = null;
    }
    return await initializeDatabase();
}

process.on('SIGTERM', async () => {
    if (pool) {
        await pool.end();
        console.log('🔒 Пул соединений MySQL закрыт');
    }
});

module.exports = { query, isConnected, initializeDatabase, reconnect };
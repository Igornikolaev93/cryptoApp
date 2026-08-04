const { Pool } = require('pg');
require('dotenv').config();

let pool = null;
let isDatabaseConnected = false;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 3;

// === ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ===
async function initializeDatabase() {
    try {
        const databaseUrl = process.env.DATABASE_URL;
        
        console.log('🔧 Подключение к PostgreSQL (Supabase)...');
        console.log(`📋 DATABASE_URL: ${databaseUrl ? '✅ установлена' : '❌ не установлена'}`);

        if (!databaseUrl) {
            console.log('⚠️ DATABASE_URL не найдена, используем fallback режим');
            isDatabaseConnected = false;
            return null;
        }

        pool = new Pool({
            connectionString: databaseUrl,
            ssl: {
                rejectUnauthorized: false
            },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });

        // Проверяем подключение
        try {
            const client = await pool.connect();
            console.log('✅ Подключение к PostgreSQL успешно!');
            
            const result = await client.query('SELECT version() as version, current_database() as database, current_user as user');
            
            console.log(`📊 База данных: ${result.rows[0].database}`);
            console.log(`👤 Пользователь: ${result.rows[0].user}`);
            console.log(`📦 Версия PostgreSQL: ${result.rows[0].version}`);
            
            client.release();
            isDatabaseConnected = true;
            connectionAttempts = 0;
            
            // Создаем таблицы
            await createTables();
            
            // Keep-alive каждые 3 минуты
            setInterval(async () => {
                if (!isDatabaseConnected || !pool) return;
                try {
                    const client = await pool.connect();
                    await client.query('SELECT 1');
                    client.release();
                    console.log('⏰ Keep-alive ping отправлен');
                } catch (error) {
                    console.log('⚠️ Потеря связи с БД:', error.message);
                    isDatabaseConnected = false;
                    setTimeout(initializeDatabase, 10000);
                }
            }, 3 * 60 * 1000);
            
            return pool;
        } catch (connError) {
            console.error('❌ Ошибка подключения к PostgreSQL:', connError.message);
            console.log('⚠️ БД недоступна, приложение будет работать в fallback режиме');
            isDatabaseConnected = false;
            return null;
        }
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error.message);
        isDatabaseConnected = false;
        return null;
    }
}

// === СОЗДАНИЕ ТАБЛИЦ ===
async function createTables() {
    try {
        console.log('📝 Проверка и создание таблиц...');

        // Таблица пользователей
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                hashed_password VARCHAR(200) NOT NULL,
                full_name VARCHAR(100),
                phone VARCHAR(20),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITH TIME ZONE,
                is_active BOOLEAN DEFAULT TRUE,
                is_verified BOOLEAN DEFAULT FALSE,
                is_admin BOOLEAN DEFAULT FALSE,
                preferred_fiat VARCHAR(10) DEFAULT 'USD'
            )
        `);

        // Таблица операций
        await query(`
            CREATE TABLE IF NOT EXISTS operations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                operation_type VARCHAR(20) NOT NULL,
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
                status VARCHAR(20) DEFAULT 'pending',
                transaction_hash VARCHAR(200),
                blockchain_confirmations INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE,
                notes TEXT,
                admin_notes TEXT
            )
        `);

        console.log('✅ Таблицы созданы или уже существуют');

        // Проверяем наличие таблиц
        const result = await query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'operations')
        `);
        
        console.log(`📊 Найдено таблиц: ${result.rowCount}`);
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

    } catch (error) {
        console.error('❌ Ошибка создания таблиц:', error.message);
    }
}

// === ОСНОВНАЯ ФУНКЦИЯ ЗАПРОСОВ ===
async function query(sql, params = []) {
    // Если БД не подключена, используем fallback
    if (!pool || !isDatabaseConnected) {
        console.log('⚠️ База данных не доступна, используем fallback (возвращаем пустые данные)');
        return { rows: [], rowCount: 0 };
    }

    try {
        const result = await pool.query(sql, params);
        return { rows: result.rows, rowCount: result.rowCount };
    } catch (error) {
        console.error('❌ Ошибка запроса:', error.message);
        console.error('  - SQL:', sql.substring(0, 100));
        
        // Если ошибка соединения, пробуем переподключиться
        if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
            error.code === 'ECONNRESET' || 
            error.message.includes('timeout')) {
            isDatabaseConnected = false;
            console.log('🔄 Переподключение к БД...');
            await initializeDatabase();
            
            // Повторяем запрос, если подключились
            if (isDatabaseConnected) {
                const result = await pool.query(sql, params);
                return { rows: result.rows, rowCount: result.rowCount };
            }
        }
        
        // Возвращаем пустой результат вместо ошибки
        return { rows: [], rowCount: 0 };
    }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
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

// === ОБРАБОТЧИКИ ЗАВЕРШЕНИЯ ===
process.on('SIGTERM', async () => {
    if (pool) {
        await pool.end();
        console.log('🔒 Пул соединений PostgreSQL закрыт');
    }
});

process.on('SIGINT', async () => {
    if (pool) {
        await pool.end();
        console.log('🔒 Пул соединений PostgreSQL закрыт');
    }
    process.exit(0);
});

// === ЭКСПОРТ ===
module.exports = { 
    query, 
    isConnected, 
    initializeDatabase, 
    reconnect 
};
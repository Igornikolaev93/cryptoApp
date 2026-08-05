const { Pool } = require('pg');
require('dotenv').config();

let pool = null;
let isDatabaseConnected = false;

// === ВРЕМЕННОЕ ХРАНИЛИЩЕ В ПАМЯТИ (FALLBACK) ===
const memoryStorage = {
    users: [],
    operations: [],
    sessions: {},
    idCounter: 1
};

// === ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ===
async function initializeDatabase() {
    try {
        const databaseUrl = process.env.DATABASE_URL;
        
        console.log('🔧 Подключение к PostgreSQL (Supabase)...');
        console.log(`📋 DATABASE_URL: ${databaseUrl ? '✅ установлена' : '❌ не установлена'}`);

        if (!databaseUrl) {
            console.log('⚠️ DATABASE_URL не найдена, используем MEMORY STORAGE');
            isDatabaseConnected = false;
            return null;
        }

        pool = new Pool({
            connectionString: databaseUrl,
            ssl: { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });

        const client = await pool.connect();
        console.log('✅ Подключение к PostgreSQL успешно!');
        client.release();
        isDatabaseConnected = true;

        await createTables();
        return pool;
    } catch (error) {
        console.error('❌ Ошибка подключения, используем MEMORY STORAGE:', error.message);
        isDatabaseConnected = false;
        return null;
    }
}

// === СОЗДАНИЕ ТАБЛИЦ ===
async function createTables() {
    try {
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
    } catch (error) {
        console.error('❌ Ошибка создания таблиц:', error.message);
    }
}

// === ОСНОВНАЯ ФУНКЦИЯ ЗАПРОСОВ С FALLBACK ===
async function query(sql, params = []) {
    // Если БД подключена, используем её
    if (pool && isDatabaseConnected) {
        try {
            const result = await pool.query(sql, params);
            return { rows: result.rows, rowCount: result.rowCount };
        } catch (error) {
            console.error('❌ Ошибка запроса к БД:', error.message);
            console.log('⚠️ Переключаемся на MEMORY STORAGE');
            isDatabaseConnected = false;
            return memoryQuery(sql, params);
        }
    }
    
    // Используем память
    return memoryQuery(sql, params);
}

// === FALLBACK: ЗАПРОСЫ В ПАМЯТИ ===
function memoryQuery(sql, params = []) {
    console.log('📝 MEMORY STORAGE: Выполнение запроса');
    
    const sqlLower = sql.toLowerCase().trim();
    
    // --- SELECT ---
    if (sqlLower.startsWith('select')) {
        // Поиск пользователей
        if (sqlLower.includes('from users')) {
            if (params.length > 0) {
                const searchValue = params[0];
                const filtered = memoryStorage.users.filter(u => 
                    u.email === searchValue || u.username === searchValue
                );
                return { rows: filtered, rowCount: filtered.length };
            }
            return { rows: memoryStorage.users, rowCount: memoryStorage.users.length };
        }
        
        // Поиск операций
        if (sqlLower.includes('from operations')) {
            if (params.length > 0) {
                const userId = params[0];
                const filtered = memoryStorage.operations.filter(o => o.user_id === userId);
                return { rows: filtered, rowCount: filtered.length };
            }
            return { rows: memoryStorage.operations, rowCount: memoryStorage.operations.length };
        }
        
        return { rows: [], rowCount: 0 };
    }
    
    // --- INSERT ---
    if (sqlLower.startsWith('insert')) {
        // Создание пользователя
        if (sqlLower.includes('into users')) {
            const [username, email, hashed_password, full_name, phone] = params;
            const newUser = {
                id: memoryStorage.idCounter++,
                username,
                email,
                hashed_password,
                full_name: full_name || null,
                phone: phone || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                last_login: null,
                is_active: true,
                is_verified: false,
                is_admin: false,
                preferred_fiat: 'USD'
            };
            memoryStorage.users.push(newUser);
            console.log('✅ MEMORY: Пользователь создан, ID:', newUser.id);
            return { rows: [{ id: newUser.id }], rowCount: 1 };
        }
        
        // Создание операции
        if (sqlLower.includes('into operations')) {
            const [user_id, operation_type, crypto_currency, crypto_amount, 
                   fiat_currency, fiat_amount, fee, payment_method, 
                   wallet_address, status, notes] = params;
            const newOperation = {
                id: memoryStorage.idCounter++,
                user_id,
                operation_type,
                crypto_currency,
                crypto_amount: parseFloat(crypto_amount),
                fiat_currency,
                fiat_amount: parseFloat(fiat_amount),
                fee_amount: parseFloat(fee) || 0,
                fee_currency: fiat_currency,
                payment_method: payment_method || null,
                wallet_address: wallet_address || null,
                status: status || 'pending',
                notes: notes || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            memoryStorage.operations.push(newOperation);
            console.log('✅ MEMORY: Операция создана, ID:', newOperation.id);
            return { rows: [{ id: newOperation.id }], rowCount: 1 };
        }
        return { rows: [{ id: memoryStorage.idCounter++ }], rowCount: 1 };
    }
    
    // --- UPDATE ---
    if (sqlLower.startsWith('update')) {
        // Обновление пользователя (например, last_login)
        if (sqlLower.includes('users')) {
            const userId = params[params.length - 1]; // Последний параметр обычно id
            const user = memoryStorage.users.find(u => u.id === userId);
            if (user) {
                user.last_login = new Date().toISOString();
                console.log('✅ MEMORY: Обновлен пользователь, ID:', userId);
            }
        }
        return { rows: [], rowCount: 1 };
    }
    
    // --- DELETE ---
    if (sqlLower.startsWith('delete')) {
        return { rows: [], rowCount: 0 };
    }
    
    console.log('⚠️ MEMORY: Неподдерживаемый запрос:', sql.substring(0, 50));
    return { rows: [], rowCount: 0 };
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function isConnected() {
    return isDatabaseConnected;
}

function getStorage() {
    return memoryStorage;
}

async function reconnect() {
    isDatabaseConnected = false;
    if (pool) {
        try { await pool.end(); } catch (e) {}
        pool = null;
    }
    return await initializeDatabase();
}

module.exports = { 
    query, 
    isConnected, 
    initializeDatabase, 
    reconnect,
    getStorage,
    memoryStorage
};
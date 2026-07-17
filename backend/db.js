const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;
let isDatabaseConnected = false;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 5;

async function initializeDatabase() {
    try {
        const host = process.env.DB_HOST || 'rufree53.hostiman.ru';
        const port = parseInt(process.env.DB_PORT) || 3306;
        
        console.log('🔧 Подключение к MySQL (Vercel)...');
        console.log(`📋 Хост: ${host}:${port}`);
        console.log(`📋 База: ${process.env.DB_NAME}`);
        console.log(`📋 Пользователь: ${process.env.DB_USER}`);

        if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
            throw new Error('Отсутствуют переменные окружения');
        }

        pool = mysql.createPool({
            host: host,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: port,
            waitForConnections: true,
            connectionLimit: 5, // Vercel ограничивает
            queueLimit: 0,
            connectTimeout: 30000,
            // Включите SSL если требуется
            ssl: { rejectUnauthorized: false }
        });

        const connection = await pool.getConnection();
        console.log('✅ Подключение к MySQL успешно!');
        
        const [rows] = await connection.query(
            'SELECT VERSION() as version, DATABASE() as database, USER() as user, @@hostname as host'
        );
        
        console.log(`📊 База данных: ${rows[0].database}`);
        console.log(`👤 Пользователь: ${rows[0].user}`);
        console.log(`🖥️ Сервер: ${rows[0].host}`);
        
        connection.release();
        isDatabaseConnected = true;
        connectionAttempts = 0;

        // Keep-alive (Vercel не поддерживает долгие интервалы)
        if (process.env.VERCEL_ENV !== 'production') {
            setInterval(async () => {
                if (!isDatabaseConnected || !pool) return;
                try {
                    const conn = await pool.getConnection();
                    await conn.query('SELECT 1');
                    conn.release();
                    console.log('⏰ Keep-alive ping отправлен');
                } catch (error) {
                    console.log('⚠️ Потеря связи с БД');
                    isDatabaseConnected = false;
                    setTimeout(initializeDatabase, 10000);
                }
            }, 3 * 60 * 1000); // Каждые 3 минуты
        }

        return pool;
    } catch (error) {
        console.error('❌ Ошибка подключения:', error.message);
        isDatabaseConnected = false;
        connectionAttempts++;
        
        if (connectionAttempts < MAX_ATTEMPTS) {
            const delay = 5000 * connectionAttempts;
            console.log(`🔄 Повторная попытка через ${delay/1000}с... (${connectionAttempts}/${MAX_ATTEMPTS})`);
            setTimeout(initializeDatabase, delay);
        }
        return null;
    }
}

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
            // Повторяем запрос
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

// Закрытие пула при завершении
process.on('SIGTERM', async () => {
    if (pool) {
        await pool.end();
        console.log('🔒 Пул соединений закрыт');
    }
});

module.exports = { query, isConnected, initializeDatabase, reconnect };
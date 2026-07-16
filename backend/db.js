// backend/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;
let isDatabaseConnected = false;

async function initializeDatabase() {
    try {
        const host = process.env.DB_HOST || 'rufree53.hostiman.ru';
        const port = parseInt(process.env.DB_PORT) || 3306;
        
        console.log('🔧 Подключение к MySQL (Hostiman)...');
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
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 30000,
            // Для внешнего подключения может потребоваться SSL
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

        // Keep-alive каждые 5 минут
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
        }, 5 * 60 * 1000);

        return pool;
    } catch (error) {
        console.error('❌ Ошибка подключения:', error.message);
        isDatabaseConnected = false;
        setTimeout(initializeDatabase, 15000);
        return null;
    }
}

async function query(sql, params = []) {
    if (!pool || !isDatabaseConnected) {
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
        throw error;
    }
}

function isConnected() {
    return isDatabaseConnected;
}

async function reconnect() {
    isDatabaseConnected = false;
    return await initializeDatabase();
}

module.exports = { query, isConnected, initializeDatabase, reconnect };
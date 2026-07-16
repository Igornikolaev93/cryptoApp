// backend/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;
let isDatabaseConnected = false;

/**
 * Инициализация подключения к MySQL (Hostiman)
 */
async function initializeDatabase() {
    try {
        console.log('🔧 Подключение к MySQL (Hostiman)...');
        
        // Проверяем наличие всех необходимых переменных
        if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
            console.error('❌ Отсутствуют данные для подключения к БД!');
            console.log('Проверьте переменные: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
            return null;
        }

        pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 15000,
            // Если Hostiman требует SSL:
            // ssl: { rejectUnauthorized: false }
        });

        // Проверяем подключение
        const connection = await pool.getConnection();
        console.log('✅ Подключение к MySQL успешно!');
        
        const [rows] = await connection.query('SELECT VERSION() as version, DATABASE() as database, USER() as user');
        console.log(`📊 База данных: ${rows[0].database}`);
        console.log(`👤 Пользователь: ${rows[0].user}`);
        console.log(`🔧 Версия MySQL: ${rows[0].version}`);
        
        connection.release();
        isDatabaseConnected = true;

        // Keep-alive (каждые 10 минут)
        setInterval(async () => {
            try {
                const conn = await pool.getConnection();
                await conn.query('SELECT 1');
                conn.release();
                console.log('⏰ Keep-alive ping отправлен');
            } catch (error) {
                console.log('⚠️ Потеря связи с БД, переподключаемся...');
                isDatabaseConnected = false;
                setTimeout(initializeDatabase, 5000);
            }
        }, 10 * 60 * 1000);

        return pool;

    } catch (error) {
        console.error('❌ Ошибка подключения к MySQL:', error.message);
        isDatabaseConnected = false;
        
        // Повторная попытка через 10 секунд
        console.log('⏳ Повторная попытка через 10 секунд...');
        setTimeout(initializeDatabase, 10000);
        return null;
    }
}

/**
 * Выполнение запроса к базе данных
 */
async function query(sql, params = []) {
    if (!pool || !isDatabaseConnected) {
        throw new Error('База данных не подключена');
    }

    try {
        const [rows] = await pool.query(sql, params);
        return { rows, rowCount: rows.length };
    } catch (error) {
        console.error('❌ Ошибка выполнения запроса:', error.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        throw error;
    }
}

/**
 * Получение одного пользователя по условию
 */
async function getOne(sql, params = []) {
    const result = await query(sql, params);
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Проверка статуса подключения
 */
function isConnected() {
    return isDatabaseConnected;
}

/**
 * Переподключение к базе
 */
async function reconnect() {
    console.log('🔄 Переподключение к базе...');
    isDatabaseConnected = false;
    return await initializeDatabase();
}

module.exports = {
    query,
    getOne,
    isConnected,
    initializeDatabase,
    reconnect,
    pool: () => pool
};
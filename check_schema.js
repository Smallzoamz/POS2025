const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function check() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'line_orders'");
        console.log('COLUMNS:', JSON.stringify(res.rows.map(r => r.column_name)));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
check();

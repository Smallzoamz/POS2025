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
        const timeRes = await pool.query(`
            SELECT 
                CURRENT_DATE as global_date,
                (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date as local_date_bangkok,
                (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok') as local_now_bangkok
        `);
        console.log('TIME_INFO:', JSON.stringify(timeRes.rows[0]));

        const dashboardQuery = `
            SELECT id, status, updated_at, total_amount, (updated_at AT TIME ZONE 'Asia/Bangkok')::date as sql_local_date 
            FROM orders 
            WHERE status = 'paid' AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date = CURRENT_DATE
        `;
        const dashboardRes = await pool.query(dashboardQuery);
        console.log('DASHBOARD_MATCHES:', JSON.stringify(dashboardRes.rows));

        const todayStr = new Date().toISOString().split('T')[0];
        console.log('CLIENT_TODAY_STR:', todayStr);

        const historyQuery = `
            SELECT id, status, updated_at, (updated_at AT TIME ZONE 'Asia/Bangkok')::date as local_date 
            FROM orders 
            WHERE status = 'paid' 
            AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date >= $1 
            AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date <= $2
        `;
        const historyRes = await pool.query(historyQuery, [todayStr, todayStr]);
        console.log('HISTORY_PARAM_RESULTS:', JSON.stringify(historyRes.rows));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
check();

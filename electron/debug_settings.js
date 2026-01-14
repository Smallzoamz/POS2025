
const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'pos2025',
    password: '123456',
    port: 5432
});

client.connect()
    .then(async () => {
        const res = await client.query("SELECT * FROM settings WHERE key IN ('promptpay_number', 'promptpay_name')");
        console.log('Settings found:', res.rows);
        await client.end();
    })
    .catch(err => {
        console.error('Error:', err);
        client.end();
    });

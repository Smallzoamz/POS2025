const readline = require('readline');
const { pool } = require('../electron/db_pg');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const isProd = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;

console.log(`\n⚠️  WARNING: You are about to DELETE ALL ORDER DATA.`);
if (isProd) {
    console.log(`🔥  ENVIRONMENT: PRODUCTION / CLOUD (Check DATABASE_URL)`);
} else {
    console.log(`🏠  ENVIRONMENT: LOCAL`);
}
console.log(`---------------------------------------------------------`);
console.log(`This will TRUNCATE the following tables:`);
console.log(` - orders`);
console.log(` - line_orders`);
console.log(` - loyalty_point_transactions`);
console.log(` - notifications`);
console.log(` - attendance_logs`);
console.log(`And RESET all tables to 'available'.`);
console.log(`---------------------------------------------------------`);

rl.question('Are you sure you want to proceed? (Type "yes" to confirm): ', async (answer) => {
    if (answer.toLowerCase() === 'yes') {
        await resetOrders();
    } else {
        console.log('❌  Operation cancelled.');
        process.exit(0);
    }
    rl.close();
});

async function resetOrders() {
    const client = await pool.connect();
    try {
        console.log('\n🗑️  Starting Order Data Reset...');
        await client.query('BEGIN');

        // 1. Truncate Order Tables (CASCADE will handle items & options)
        console.log('   - Clearing Orders & Line Orders & Attendance...');
        await client.query('TRUNCATE orders, line_orders, loyalty_point_transactions, notifications, attendance_logs CASCADE');

        // 2. Reset Table Statuses to 'available'
        console.log('   - Resetting Table Statuses...');
        await client.query("UPDATE tables SET status = 'available'");

        // 3. Reset Product Stock? - NO, keep stock as is.

        await client.query('COMMIT');
        console.log('✅  Success! All order data has been wiped.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌  Error during reset:', err);
    } finally {
        client.release();
        pool.end(); // Close pool to verify exit
        process.exit(0);
    }
}

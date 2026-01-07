const fetch = require('node-fetch');

async function test() {
    const today = new Date().toISOString().split('T')[0];
    const url = `http://localhost:3000/api/orders/history?startDate=${today}&endDate=${today}`;
    console.log(`URL: ${url}`);
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log('STATUS:', res.status);
        console.log('DATA_LENGTH:', data.length);
        console.log('DATA_SAMPLE:', JSON.stringify(data.slice(0, 1)));
    } catch (err) {
        console.error('FETCH_ERROR:', err.message);
    }
}
test();

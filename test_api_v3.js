const http = require('http');

const today = new Date().toISOString().split('T')[0];
const url = `/api/orders/history?startDate=${today}&endDate=${today}`;

const options = {
    hostname: 'localhost',
    port: 3000,
    path: url,
    method: 'GET'
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('DATA_LENGTH:', Array.isArray(json) ? json.length : 'NOT_ARRAY');
            console.log('DATA_SAMPLE:', JSON.stringify(Array.isArray(json) ? json.slice(0, 1) : json));
        } catch (e) {
            console.log('PARSE_ERROR:', e.message);
            console.log('RAW_DATA:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`PROBLEM_WITH_REQUEST: ${e.message}`);
});

req.end();

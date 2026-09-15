const fetch = require('node-fetch');
const readline = require('readline');
const crypto = require('crypto');
require('dotenv').config();

const APP_SECRET = process.env.APP_SECRET || "3f8a7c12d9e54b88b6a2f4d915c3e7a1";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

/**
 * Create HMAC-SHA-256 signature
 * @param {string} data - The data to sign (params + timestamp)
 * @param {string} secret - The secret key
 * @returns {string} Base64 encoded signature
 */
function createSignature(data, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    return hmac.digest('base64');
}

async function login(username, password) {
    const url = 'https://app.tarc.edu.my/MobileService/studentLogin.jsp';
    
    // Generate timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Create params object
    const params = {
        username: username,
        password: password,
        deviceid: '12345678-1234-1234-1234-123456789012',
        devicemodel: 'Test Device',
        appversion: '2.0.19',
        fplatform: 'ios'
    };
    
    // Create signature data: key=value&key=value|timestamp (not URL encoded)
    const paramsString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    const signatureData = paramsString + '|' + timestamp;
    console.log('Signature data:', signatureData);
    const signature = createSignature(signatureData, APP_SECRET);
    console.log('Generated signature:', signature);
    
    // Create URLSearchParams for the actual request body
    const loginData = new URLSearchParams(params);
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/134.0.6998.39 Mobile Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'ionic://localhost',
        'Referer': 'https://localhost/',
        'X-Signature': signature,
        'X-Timestamp': timestamp.toString()
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: loginData.toString()
        });

        const raw = await response.text();
        console.log('\n=== LOGIN RESPONSE (RAW) ===');
        console.log(raw);
        
        // Parse JSON from response (server may return HTML before JSON)
        const jsonStart = raw.lastIndexOf('{');
        if (jsonStart === -1) {
            throw new Error("Login response does not contain JSON");
        }
        
        const jsonPart = raw.slice(jsonStart);
        const data = JSON.parse(jsonPart);
        
        console.log('\n=== LOGIN RESPONSE (PARSED) ===');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.msg === 'success' && data.token) {
            return data.token;
        } else {
            throw new Error(data.msgdesc || 'Login failed');
        }
    } catch (error) {
        throw new Error(`Login failed: ${error.message}`);
    }
}

async function getTodayList(token) {
    // Generate timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // For GET request with query params
    const params = {
        act: 'get-today-list'
    };
    
    const paramsString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    const signatureData = paramsString + '|' + timestamp;
    const signature = createSignature(signatureData, APP_SECRET);
    
    const url = 'https://app.tarc.edu.my/MobileService/services/AJAXAttendance.jsp?act=get-today-list';
    
    const headers = {
        'X-Auth': token,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Signature': signature,
        'X-Timestamp': timestamp.toString()
    };

    try {
        console.log('\n=== CALLING GET-TODAY-LIST API ===');
        console.log('URL:', url);
        console.log('Headers:', headers);
        
        const response = await fetch(url, {
            method: 'GET',
            headers
        });

        const text = await response.text();
        console.log('\n=== TODAY LIST RESPONSE ===');
        console.log('Status:', response.status);
        console.log('Response:');
        console.log(text);
        
        // Try to parse as JSON
        try {
            const data = JSON.parse(text);
            console.log('\n=== PARSED JSON ===');
            console.log(JSON.stringify(data, null, 2));
        } catch (e) {
            console.log('(Not valid JSON)');
        }
        
        return text;
    } catch (error) {
        throw new Error(`Failed to get today list: ${error.message}`);
    }
}

async function submitAttendance(token, code) {
    const url = 'https://app.tarc.edu.my/MobileService/services/AJAXAttendance.jsp';
    
    // Generate timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Create params object
    const params = {
        act: 'insert',
        fsigncd: code,
        deviceid: '12345678-1234-1234-1234-123456789012',
        devicemodel: 'Test Device'
    };
    
    // Create signature data
    const paramsString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    const signatureData = paramsString + '|' + timestamp;
    const signature = createSignature(signatureData, APP_SECRET);
    
    const attendanceData = new URLSearchParams(params);
    
    const headers = {
        'X-Auth': token,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Signature': signature,
        'X-Timestamp': timestamp.toString()
    };

    try {
        console.log('\n=== SUBMITTING ATTENDANCE ===');
        console.log('URL:', url);
        console.log('Code:', code);
        
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: attendanceData.toString()
        });

        const text = await response.text();
        console.log('\n=== ATTENDANCE RESPONSE (RAW) ===');
        console.log('Status:', response.status);
        console.log('Response:', text);
        
        // Try to parse as JSON
        try {
            const data = JSON.parse(text);
            console.log('\n=== PARSED JSON ===');
            console.log(JSON.stringify(data, null, 2));
            return data;
        } catch (e) {
            console.log('(Not valid JSON)');
            return null;
        }
    } catch (error) {
        throw new Error(`Failed to submit attendance: ${error.message}`);
    }
}

async function main() {
    try {
        console.log('=== TARUMT API TESTER ===\n');
        
        const mode = await question('Choose mode:\n1. Login with credentials\n2. Use existing token\nEnter choice (1 or 2): ');
        
        let token;
        
        if (mode.trim() === '2') {
            token = await question('\nEnter your auth token: ');
            token = token.trim();
            console.log('\n✓ Using provided token');
        } else {
            const username = await question('\nEnter Student ID: ');
            const password = await question('Enter Password: ');
            
            console.log('\nLogging in...');
            token = await login(username, password);
            console.log('\n✓ Login successful!');
            console.log('Token:', token);
        }
        
        console.log('\nFetching today\'s attendance list...');
        await getTodayList(token);
        
        // Test attendance submission
        const code = await question('\nEnter attendance code to test (or press Enter to skip): ');
        if (code.trim()) {
            console.log('\nSubmitting attendance...');
            const result = await submitAttendance(token, code.trim());
            
            if (result) {
                console.log('\n=== ANALYSIS ===');
                console.log('msg:', result.msg);
                console.log('msgdesc:', result.msgdesc);
                if (result.class) {
                    console.log('class:', result.class);
                }
            }
        }
        
        console.log('\n✓ Test completed!');
        
    } catch (error) {
        console.error('\n✗ Error:', error.message);
    } finally {
        rl.close();
    }
}

main();

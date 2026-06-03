require('dotenv').config(); // must run before any module that reads process.env at load time (e.g. telegram.js)

const fs = require('fs');
const path = require('path');

// dev logs: tee stdout + stderr into ./logs/<timestamp>.log
const sessionTs = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(__dirname, '..', 'logs', `${sessionTs}.log`);
fs.mkdirSync(path.dirname(logFile), { recursive: true });
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const teeStdout = process.stdout.write.bind(process.stdout);
const teeStderr = process.stderr.write.bind(process.stderr);
process.stdout.write = (chunk, ...rest) => { logStream.write(chunk); return teeStdout(chunk, ...rest); };
process.stderr.write = (chunk, ...rest) => { logStream.write(chunk); return teeStderr(chunk, ...rest); };
console.log(`[dev-logs] writing to ${logFile}`);

const express = require('express')
const app = express()
const status = require('./status');

const port = process.env.PORT || 3000;
//const port = 8080;

//set view engine
app.set('views', './views');
app.set("view engine", "jade")

app.use(express.static('css'));

app.get('/', async function (req, res) {
    status.needUpdate = true;
    res.render('status', status.data);
});

app.get('/api', async function (req, res) {
    res.render('api');
});


app.get('/json', async function (req, res) {
    status.needUpdate = true;
    res.json(status.data);
});

// start monitor status
status.start();

console.log(`[server] attempting to listen on port ${port}...`);
const server = app.listen(port, () => {
    const addr = server.address();
    console.log(`[server] listening on http://localhost:${addr.port} (PID ${process.pid})`);
});
server.on('error', (err) => {
    console.error(`[server] listen error on port ${port}:`, err.code || err.message, err);
});

// this catched the exception thrown by lite client.
process.on('uncaughtException', function (err) {
    // Handle the error safely
    // TOO MUCH LOGS console.log('uncaughtException:', err);
});
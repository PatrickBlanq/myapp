const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const { execSync } = require('child_process');
const UUID = '792c9cd6-9ece-4ebc-ff02-86eaf8bf7e73';
const uuid = UUID.replace(/-/g, "");

const NODE_PERSONALIZE = "echo ok"

const PORT = process.env.PORT || 3000;

const fetch = require("node-fetch");
async function getPublicIP() {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    console.log("Public aIP:", data.ip);
}

async function getPublicIPv6() {
    try {
        const res = await fetch("https://api64.ipify.org?format=json");
        const data = await res.json();
        console.log("Public IPv6:", data.ip);
    } catch (err) {
        console.log("IPv6:", err.message);
    }
}

getPublicIP();
getPublicIPv6();
function ensureModule(name) {
    try {
        require.resolve(name);
    } catch (e) {
        console.log(`Module '${name}' not found. Installing...`);
        execSync(`npm install ${name}`, { stdio: 'inherit' });
    }
}

ensureModule('ws');
const { WebSocket, createWebSocketStream } = require('ws');


const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        return res.end("Not Found");
    }
    const ext = path.extname(filePath);
    const map = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };

    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    ws.once('message', msg => {
        const [VERSION] = msg;
        const id = msg.slice(1, 17);

        // UUID 校验
        if (!id.every((v, i) => v == parseInt(uuid.substr(i * 2, 2), 16))) {
            console.log("UUID mismatch, closing");
            return ws.close();
        }

        let i = msg.slice(17, 18).readUInt8() + 19;
        const port = msg.slice(i, i += 2).readUInt16BE(0);
        const ATYP = msg.slice(i, i += 1).readUInt8();

        const host = ATYP == 1 ? msg.slice(i, i += 4).join('.') :
            (ATYP == 2 ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) :
                (ATYP == 3 ? msg.slice(i, i += 16)
                    .reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), [])
                    .map(b => b.readUInt16BE(0).toString(16)).join(':') : ''));

        ws.send(new Uint8Array([VERSION, 0]));

        const duplex = createWebSocketStream(ws);

        net.connect({ host, port }, function () {
            this.write(msg.slice(i));
            duplex.on('error', () => { }).pipe(this).on('error', () => { }).pipe(duplex);
        }).on('error', () => { });
    }).on('error', () => { });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP：http://localhost:${PORT}`);
});
// 每 24 小时自动重启
setTimeout(() => {
    process.exit(0);
}, 24 * 60 * 60 * 1000);


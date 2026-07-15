#!/usr/bin/env node
/**
 * Mote Control Server — WebSocket relay for external control
 *
 * Usage: node control-server.js [--port 8080] [--osc-port 9000]
 *
 * Endpoints:
 *   WebSocket: ws://localhost:8080  — bidirectional control messages
 *   REST API:  POST http://localhost:8080/preset  {name:"ickna"}
 *              POST http://localhost:8080/param   {key:"scale", value:0.5}
 *              POST http://localhost:8080/effect  {type:"fire"}
 *              POST http://localhost:8080/play    {index:0}
 *              POST http://localhost:8080/stop    {}
 *   OSC:       /mote/preset <name>
 *              /mote/param  <key> <value>
 *              /mote/effect <type>
 *              /mote/play   <index>
 *              /mote/stop
 *
 * Zero external dependencies — uses only Node.js built-ins.
 */

const http = require('http');
const crypto = require('crypto');
const { parse } = require('url');

const PORT = parseInt(process.argv[process.argv.indexOf('--port') + 1]) || 8080;
const OSC_PORT = parseInt(process.argv[process.argv.indexOf('--osc-port') + 1]) || 0;

// ── WebSocket clients ──────────────────────────────────────────
const clients = new Set();

// ── WebSocket handshake ────────────────────────────────────────
const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptWebSocket(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) return false;

  const accept = crypto
    .createHash('sha1')
    .update(key + MAGIC)
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );

  clients.add(socket);
  console.log(`[ws] client connected (${clients.size} total)`);

  let buffer = Buffer.alloc(0);

  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);

    while (buffer.length >= 2) {
      // Parse WebSocket frame
      const opcode = buffer[0] & 0x0f;

      // Close frame
      if (opcode === 0x8) {
        console.log('[ws] client disconnected');
        clients.delete(socket);
        socket.destroy();
        return;
      }

      // Ping frame — respond with pong
      if (opcode === 0x9) {
        const pong = Buffer.alloc(2);
        pong[0] = 0x8a;
        pong[1] = 0x00;
        socket.write(pong);
        buffer = buffer.slice(2);
        continue;
      }

      // Text or binary frame
      if (opcode !== 0x1 && opcode !== 0x2) {
        // Unknown opcode, skip
        buffer = buffer.slice(1);
        continue;
      }

      const masked = (buffer[1] & 0x80) !== 0;
      let payloadLen = buffer[1] & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskOffset = masked ? offset + 4 : offset;
      const totalLen = maskOffset + payloadLen;
      if (buffer.length < totalLen) return;

      let payload;
      if (masked) {
        const mask = buffer.slice(offset, offset + 4);
        payload = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
          payload[i] = buffer[maskOffset + i] ^ mask[i % 4];
        }
      } else {
        payload = buffer.slice(maskOffset, maskOffset + payloadLen);
      }

      buffer = buffer.slice(totalLen);

      // Parse incoming message (echo for testing)
      try {
        const msg = JSON.parse(payload.toString());
        handleIncoming(msg, socket);
      } catch (e) {
        // Ignore non-JSON
      }
    }
  });

  socket.on('error', () => {
    clients.delete(socket);
  });

  socket.on('close', () => {
    clients.delete(socket);
  });

  return true;
}

function handleIncoming(msg, source) {
  // Incoming messages from browser clients are logged and can be
  // forwarded to other clients if needed (e.g., for multi-display sync)
  console.log('[ws] <-', JSON.stringify(msg));
}

// ── Broadcast to all WebSocket clients ─────────────────────────
function broadcast(msg) {
  const payload = Buffer.from(JSON.stringify(msg), 'utf8');
  const len = payload.length;

  let frame;
  if (len < 126) {
    frame = Buffer.alloc(2 + len);
    frame[0] = 0x81; // text frame, FIN
    frame[1] = len;
    payload.copy(frame, 2);
  } else if (len < 65536) {
    frame = Buffer.alloc(4 + len);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(len, 2);
    payload.copy(frame, 4);
  } else {
    frame = Buffer.alloc(10 + len);
    frame[0] = 0x81;
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(len), 2);
    payload.copy(frame, 10);
  }

  let sent = 0;
  for (const client of clients) {
    try {
      client.write(frame);
      sent++;
    } catch (e) {
      clients.delete(client);
    }
  }
  return sent;
}

// ── REST API ───────────────────────────────────────────────────
function handleREST(req, res, body) {
  const url = parse(req.url, true);
  const path = url.pathname.replace(/\/$/, '');

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed, use POST' }));
    return;
  }

  let parsed;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  let cmd;
  switch (path) {
    case '/preset':
      cmd = { cmd: 'preset', name: parsed.name || parsed.preset || 'ickna' };
      if (parsed.preset) cmd.preset = parsed.preset;
      break;
    case '/param':
      if (!parsed.key) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing key' }));
        return;
      }
      cmd = { cmd: 'param', key: parsed.key, value: parsed.value };
      break;
    case '/effect':
      if (!parsed.type) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing type (fire, ice, lightning)' }));
        return;
      }
      cmd = { cmd: 'effect', type: parsed.type };
      break;
    case '/play':
      cmd = { cmd: 'play', index: parsed.index || 0 };
      break;
    case '/stop':
      cmd = { cmd: 'stop' };
      break;
    default:
      res.writeHead(404);
      res.end(JSON.stringify({
        error: 'Unknown endpoint',
        available: ['/preset', '/param', '/effect', '/play', '/stop']
      }));
      return;
  }

  const sent = broadcast(cmd);
  console.log(`[rest] ${path} -> ${sent} client(s)`, JSON.stringify(cmd));
  res.writeHead(200);
  res.end(JSON.stringify({ ok: true, sent }));
}

// ── HTTP Server ────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Check for WebSocket upgrade
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    acceptWebSocket(req, req.socket);
    return; // Don't end the response — socket is now upgraded
  }

  // Handle REST API
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => handleREST(req, res, body));
});

server.on('upgrade', (req, socket) => {
  // Handle upgrade event (some Node versions fire this)
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    acceptWebSocket(req, socket);
  }
});

server.listen(PORT, () => {
  console.log(`[mote-control] HTTP + WebSocket server on port ${PORT}`);
  console.log(`  REST:  POST http://localhost:${PORT}/preset|param|effect|play|stop`);
  console.log(`  WS:    ws://localhost:${PORT}`);
});

// ── Optional OSC Server ────────────────────────────────────────
if (OSC_PORT > 0) {
  const dgram = require('dgram');
  const oscServer = dgram.createSocket('udp4');

  oscServer.on('message', (msg) => {
    try {
      // Minimal OSC parser — handles single-argument messages
      // OSC bundle format: #bundle\0 + timetag + size + message
      let offset = 0;

      // Skip bundle header if present
      if (msg.toString('utf8', 0, 8) === '#bundle\0') {
        offset = 16; // skip bundle header + timetag
      }
      while (offset < msg.length - 4) {
        const size = msg.readUInt32BE(offset);
        offset += 4;
        if (offset + size > msg.length) break;
        parseOSCMessage(msg.slice(offset, offset + size));
        offset += size;
      }
    } catch (e) {
      // Ignore malformed OSC
    }
  });

  function parseOSCMessage(msg) {
    // Parse address pattern (null-terminated, padded to 4 bytes)
    let addrEnd = msg.indexOf(0);
    if (addrEnd === -1) return;
    const addr = msg.toString('utf8', 0, addrEnd);

    // Skip to type tag (aligned to 4 bytes)
    let tagOffset = addrEnd + 1;
    while (tagOffset % 4 !== 0) tagOffset++;
    if (tagOffset >= msg.length) return;
    if (msg[tagOffset] !== 0x2c) return; // ','
    const tags = msg.toString('utf8', tagOffset + 1, msg.indexOf(0, tagOffset) - 1);

    // Skip to arguments (aligned to 4 bytes)
    let argOffset = msg.indexOf(0, tagOffset) + 1;
    while (argOffset % 4 !== 0) argOffset++;

    // Parse arguments based on type tags
    let cmd = null;
    const args = [];
    let aOff = argOffset;

    for (let i = 0; i < tags.length; i++) {
      switch (tags[i]) {
        case 'f': // float
          args.push(msg.readFloatBE(aOff));
          aOff += 4;
          break;
        case 'i': // int32
          args.push(msg.readInt32BE(aOff));
          aOff += 4;
          break;
        case 's': { // string
          const sEnd = msg.indexOf(0, aOff);
          args.push(msg.toString('utf8', aOff, sEnd));
          aOff = sEnd + 1;
          while (aOff % 4 !== 0) aOff++;
          break;
        }
        default:
          aOff += 4; // skip unknown types
      }
    }

    // Map OSC addresses to commands
    switch (addr) {
      case '/mote/preset':
        cmd = { cmd: 'preset', name: args[0] || 'ickna' };
        break;
      case '/mote/param':
        cmd = { cmd: 'param', key: args[0], value: args[1] };
        break;
      case '/mote/effect':
        cmd = { cmd: 'effect', type: args[0] };
        break;
      case '/mote/play':
        cmd = { cmd: 'play', index: args[0] || 0 };
        break;
      case '/mote/stop':
        cmd = { cmd: 'stop' };
        break;
    }

    if (cmd) {
      const sent = broadcast(cmd);
      console.log(`[osc]  ${addr} -> ${sent} client(s)`, JSON.stringify(cmd));
    }
  }

  oscServer.bind(OSC_PORT, () => {
    console.log(`  OSC:   udp://0.0.0.0:${OSC_PORT}`);
  });
}

// ── Shutdown ───────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[mote-control] shutting down');
  for (const client of clients) {
    // Send close frame
    const close = Buffer.alloc(2);
    close[0] = 0x88;
    close[1] = 0x00;
    try { client.write(close); } catch (e) {}
  }
  process.exit(0);
});

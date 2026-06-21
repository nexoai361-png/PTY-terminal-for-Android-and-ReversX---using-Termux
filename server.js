import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { Client } from 'ssh2';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

/**
 * HIGH-POWER PTY BACKEND PRO ENGINE (v3.0)
 * Architecture: Singleton Session Manager, Modularized Lifecycle Hooks
 */
const logger = {
  error: (...args) => console.error('[ERR]', new Date().toISOString(), ...args),
  info: (...args) => console.log('[INF]', new Date().toISOString(), ...args),
  warn: (...args) => console.warn('[WRN]', new Date().toISOString(), ...args),
  debug: (...args) => { if (process.env.DEBUG) console.log('[DBG]', new Date().toISOString(), ...args) },
};

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.reaperInterval = setInterval(() => this.reap(), 60000); // Check idle every minute
    
    // Global process cleanup
    ['SIGINT', 'SIGTERM', 'exit'].forEach(sig => {
      process.on(sig, () => this.shutdown());
    });
  }

  register(sessionId, session) {
    const MAX_SESSIONS = 50;
    if (this.sessions.size >= MAX_SESSIONS) {
      session.notify('error', 'SERVER_FULL: Maximum active sessions reached');
      session.destroy('MAX_SESSIONS_REACHED');
      return;
    }
    this.sessions.set(sessionId, session);
    logger.info(`Session Registered: ${sessionId}. Active: ${this.sessions.size}`);
  }

  unregister(sessionId) {
    if (this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
      logger.info(`Session Unregistered: ${sessionId}. Active: ${this.sessions.size}`);
    }
  }

  reap() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (session.isIdle(now)) {
        logger.warn(`Reaping idle session: ${id}`);
        session.destroy('IDLE_TIMEOUT');
      }
    }
  }

  shutdown() {
    logger.warn('System shutdown initiated. Closing all sessions.');
    for (const session of this.sessions.values()) {
      session.destroy('SERVER_SHUTDOWN');
    }
    this.sessions.clear();
  }
}

const manager = new SessionManager();

class PTYSession {
  constructor(socket) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.ws = socket;
    this.client = new Client();
    this.stream = null;
    this.isDead = false;
    this.lastActivity = Date.now();
    this.config = null;
    
    manager.register(this.id, this);
  }

  isIdle(now) {
    const IDLE_LIMIT = 30 * 60 * 1000; // 30 minutes
    return (now - this.lastActivity) > IDLE_LIMIT;
  }

  notify(type, data) {
    if (this.isDead) return;
    if (this.ws.readyState === 1) {
      try {
        this.ws.send(JSON.stringify({ type, data }));
      } catch (e) {
        this.destroy('SOCKET_ERROR');
      }
    }
  }

  async connect(cfg) {
    this.config = cfg;
    this.lastActivity = Date.now();
    logger.info(`[${this.id}] SSH Connect attempt: ${cfg.username}@${cfg.host}`);
    
    this.notify('status', 'CONNECTING');

    this.client.on('banner', (msg) => this.notify('banner', msg));

    this.client.on('ready', () => {
      this.lastActivity = Date.now();
      this.notify('status', 'AUTHENTICATED');
      
      this.client.shell({
        term: 'xterm-256color',
        rows: parseInt(cfg.rows) || 24,
        cols: parseInt(cfg.cols) || 80,
        env: cfg.env || {}
      }, (err, stream) => {
        if (err) {
          logger.error(`[${this.id}] Shell error:`, err);
          return this.notify('error', 'SHELL_INIT_FAILED: ' + err.message);
        }
        
        this.stream = stream;
        this.notify('status', 'READY');

        stream.on('data', (d) => {
          this.lastActivity = Date.now();
          this.notify('data', d.toString('utf-8'));
        });

        stream.on('error', (err) => {
          logger.error(`[${this.id}] Stream error:`, err.message);
          this.notify('error', 'STREAM_INTERNAL_ERROR: ' + err.message);
        });

        stream.on('close', () => {
          logger.info(`[${this.id}] Stream closed by remote`);
          this.destroy('REMOTE_CLOSED');
        });

        stream.stderr.on('data', (d) => {
          this.notify('data', d.toString('utf-8'));
        });
      });
    });

    this.client.on('error', (err) => {
      logger.error(`[${this.id}] SSH Client error:`, err.message);
      const msg = err.level === 'client-authentication' 
        ? 'AUTH_FAILED: Invalid credentials or SSH configuration' 
        : `SSH_ERROR: ${err.message}`;
      this.notify('error', msg);
      this.destroy('SSH_ERROR');
    });

    this.client.on('end', () => this.destroy('SSH_ENDED'));
    this.client.on('close', () => this.destroy('SSH_CLOSED'));

    try {
      this.client.connect({
        host: cfg.host,
        port: parseInt(cfg.port) || 8022,
        username: cfg.username,
        password: cfg.password,
        readyTimeout: 15000,
        keepaliveInterval: 5000,
        keepaliveCountMax: 3,
        debug: (msg) => logger.debug(`[${this.id} SSH-DEBUG] ${msg}`)
      });
    } catch (e) {
      logger.error(`[${this.id}] Connection exception:`, e);
      this.notify('error', 'CONN_EXCEPTION: ' + e.message);
      this.destroy('EXCEPTION');
    }
  }

  write(data) {
    if (this.isDead) return;
    this.lastActivity = Date.now();
    if (this.stream && this.stream.writable) {
      this.stream.write(data);
    }
  }

  resize(c, r) {
    if (this.isDead) return;
    this.lastActivity = Date.now();
    if (this.stream && typeof this.stream.setWindow === 'function') {
      try { 
        this.stream.setWindow(parseInt(r), parseInt(c), 0, 0); 
        logger.debug(`[${this.id}] Resized to ${c}x${r}`);
      } catch(e){
        logger.error(`[${this.id}] Resize failure:`, e.message);
      }
    }
  }

  destroy(reason = 'UNKNOWN') {
    if (this.isDead) return;
    this.isDead = true;
    
    logger.info(`[${this.id}] Destroying session. Reason: ${reason}`);
    
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
    
    try {
      this.client.end();
      this.client.destroy();
    } catch (e) {}

    this.notify('status', 'DISCONNECTED');
    manager.unregister(this.id);
  }
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  logger.info(`New WebSocket Connection from ${ip}`);
  
  const session = new PTYSession(ws);

  ws.on('message', (msg) => {
    try {
      const p = JSON.parse(msg);
      switch (p.type) {
        case 'init': 
          session.connect(p); 
          break;
        case 'input': 
          session.write(p.data); 
          break;
        case 'resize': 
          session.resize(p.cols, p.rows); 
          break;
        case 'heartbeat':
          session.lastActivity = Date.now();
          break;
        default:
          logger.warn(`[${session.id}] Unknown message type: ${p.type}`);
      }
    } catch (e) {
      logger.error(`[${session.id}] Message parse error:`, e.message);
    }
  });

  ws.on('close', () => {
    logger.info(`[${session.id}] WebSocket closed by client`);
    session.destroy('WS_CLOSED');
  });

  ws.on('error', (err) => {
    logger.error(`[${session.id}] WebSocket error:`, err.message);
    session.destroy('WS_ERROR');
  });
});

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

server.listen(3000, () => {
  console.clear();
  console.log(`
  ==========================================
    PTY BACKEND PRO ENGINE (v3.0)
    STATUS: ONLINE (100% STABLE)
    PORT  : 3000
    TIME  : ${new Date().toLocaleTimeString()}
  ==========================================
  `);
});

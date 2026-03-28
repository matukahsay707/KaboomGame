process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — server will continue:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION — server will continue:', reason);
});

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { ClientToServerEvents, ServerToClientEvents } from '@kaboom/shared';
import { registerLobbyHandlers } from './socket/lobbyHandlers.js';
import { registerGameHandlers } from './socket/gameHandlers.js';
import { registerBotHandlers } from './socket/botHandlers.js';
import { registerMatchmakingHandlers } from './socket/matchmakingHandlers.js';
import { authMiddleware } from './socket/authMiddleware.js';
import { RoomManager } from './game/RoomManager.js';
import { BotManager } from './game/BotManager.js';
import { MatchmakingManager } from './game/MatchmakingManager.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const allowedOrigins: string[] = [process.env.CLIENT_URL ?? 'http://localhost:5173'];
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('https://*.ngrok-free.app', 'https://*.ngrok.io');
}

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((pattern) => {
        if (pattern.includes('*')) {
          const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace('*', '.*') + '$');
          return regex.test(origin);
        }
        return pattern === origin;
      });
      callback(null, isAllowed);
    },
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();
const botManager = new BotManager();
const matchmakingManager = new MatchmakingManager();

// Auth middleware
io.use(authMiddleware);

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.data.uid} (${socket.data.displayName})`);

  registerLobbyHandlers(io, socket, roomManager);
  registerGameHandlers(io, socket, roomManager, botManager);
  registerBotHandlers(io, socket, roomManager, botManager);
  registerMatchmakingHandlers(io, socket, roomManager, matchmakingManager);

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.data.uid}`);
    roomManager.handleDisconnect(socket.data.uid, io);
    matchmakingManager.handleDisconnect(io, socket.data.uid);
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve built client files in production / ngrok mode
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Kaboom server running on port ${PORT}`);
});

export { io, roomManager, botManager, matchmakingManager };

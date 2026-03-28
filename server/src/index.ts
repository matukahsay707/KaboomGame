import path from 'path';
import { fileURLToPath } from 'url';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — server will continue:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION — server will continue:', reason);
});
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

// Health check — must respond before any other middleware
app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

const corsCheck = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin (mobile apps, curl, server-to-server)
  if (!origin) return callback(null, true);
  // Allow all localhost in dev
  if (origin.includes('localhost')) return callback(null, true);
  // Allow production domains
  if (origin === 'https://playkaboom.io' || origin === 'https://www.playkaboom.io') return callback(null, true);
  // Allow Railway domain
  if (origin.includes('railway.app')) return callback(null, true);
  // Allow ngrok
  if (origin.includes('ngrok')) return callback(null, true);
  // Allow CLIENT_URL if set
  if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) return callback(null, true);
  callback(null, false);
};

app.use(cors({ origin: corsCheck, credentials: true }));
app.use(express.json());

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: corsCheck,
    methods: ['GET', 'POST'],
    credentials: true,
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


// Serve built client files in production / ngrok mode
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

console.log('Environment PORT value:', process.env.PORT);
console.log('Environment PORT type:', typeof process.env.PORT);
console.log('All env keys:', Object.keys(process.env).filter(k => k.includes('PORT') || k.includes('RAIL')));

const PORT = Number(process.env.PORT);
if (!PORT) {
  console.error('ERROR: PORT environment variable not set by Railway');
}
console.log('Using PORT:', PORT);
httpServer.listen(PORT || 8080, '0.0.0.0', () => {
  console.log(`Kaboom server running on port ${PORT || 8080}`);
});

export { io, roomManager, botManager, matchmakingManager };

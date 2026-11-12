import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import rotasAuth from "./src/routes/authRoutes.js";
import ongRoutes from './src/routes/ongRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import postRoutes from './src/routes/postRoutes.js';      
import momentRoutes from './src/routes/momentsRoutes.js';  
import donationRoutes from './src/routes/donationRoutes.js'; 
import donorRoutes from './src/routes/donorRoutes.js';
import followerRoutes from './src/routes/followerRoutes.js';
import setupChatSocket from './src/services/chatSocket.js';
import chatRoutes from './src/routes/chatRoutes.js';

const server = express();                  // O teu express mantido intacto
const httpServer = createServer(server);   // Servidor HTTP necessário para o WebSocket
const door = 8080;

const allowedOrigins = [
  'http://localhost:5173',
  'https://civvoprojeto.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
};

// Inicializa o Socket.io usando as mesmas regras de CORS
const io = new Server(httpServer, {
  cors: corsOptions
});

// Ativa os eventos do chat em tempo real
setupChatSocket(io);

server.use(express.json());
server.use(cors(corsOptions));

server.get("/teste", (req, res) => {
    res.json({ message: "Servidor rodando com sucesso!" });
});

// Suas rotas usando o `server` do Express normalmente
server.use("/api/auth", rotasAuth);
server.use("/api/ong", ongRoutes);
server.use('/api/admin', adminRoutes);
server.use('/api/posts', postRoutes);        
server.use('/api/moments', momentRoutes);    
server.use('/api/donations', donationRoutes);
server.use('/api/donor', donorRoutes);
server.use('/api/followers', followerRoutes); // Nova rota de seguidores
server.use('/api/chat', chatRoutes);

const PORT = process.env.PORT || door;

// O listen é chamado no httpServer para subir o Express e o WebSocket juntos
httpServer.listen(PORT, () => {
    console.log(`Servidor ligado na rota http://localhost:${PORT}`);
});
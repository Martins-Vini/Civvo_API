import express from "express";
import cors from "cors";
import rotasAuth from "./src/routes/authRoutes.js";
import ongRoutes from './src/routes/ongRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import postRoutes from './src/routes/postRoutes.js';      
import momentRoutes from './src/routes/momentsRoutes.js';  
import donationRoutes from './src/routes/donationRoutes.js'; 
import donorRoutes from './src/routes/donorRoutes.js';

const server = express();
const door = 8080;

server.use(express.json());

const allowedOrigins = [
  'http://localhost:5173',
  'https://civvoprojeto.vercel.app'
];

server.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
}));

server.get("/teste", (req, res) => {
    res.json({ message: "Servidor rodando com sucesso!" });
});

server.use("/api/auth", rotasAuth);
server.use("/api/ong", ongRoutes);
server.use('/api/admin', adminRoutes);
server.use('/api/posts', postRoutes);        
server.use('/api/moments', momentRoutes);    
server.use('/api/donations', donationRoutes);
server.use('/api/donor', donorRoutes);

const PORT = process.env.PORT || door;

server.listen(PORT, () => {
    console.log(`Servidor ligado na rota http://localhost:${PORT}`);
});
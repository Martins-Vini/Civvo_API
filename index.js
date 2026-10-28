import express from "express";
import cors from "cors";
import rotasAuth from "./src/routes/authRoutes.js";
import ongRoutes from './src/routes/ongRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import postRoutes from './src/routes/postRoutes.js';      
import momentRoutes from './src/routes/momentsRoutes.js';  
import donationRoutes from './src/routes/donationRoutes.js'; 

const server = express();
const door = 8080;

server.use(express.json());
server.use(cors({
    origin: ['http://localhost:5173', 'https://civvoprojeto.vercel.app/'],
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

const PORT = process.env.PORT || door;

server.listen(PORT, () => {
    console.log(`Servidor ligado na rota http://localhost:${PORT}`);
});
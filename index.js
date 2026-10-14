import express from "express";
import cors from "cors";
import rotasAuth from "./src/routes/authRoutes.js";
import ongRoutes from './src/routes/ongRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
const server = express();
const door = 8080;

server.use(express.json());
server.use(cors());

server.get("/teste", (req,res)=>{
    res.json({message: "Servidor rodando com sucesso!"})
});

server.use("/api/auth", rotasAuth);
server.use("/api/ong", ongRoutes);
server.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || door;

server.listen(PORT, ()=>{
    console.log(`Servidor ligado na rota http://localhost:${PORT}`);
});
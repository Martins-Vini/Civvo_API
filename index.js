import express from "express";
import cors from "cors";
import {pool} from "./src/config/conexao.js";
import rotasAuth from "./src/routes/authRoutes.js";
const server = express();
const door = 8080;

server.use(express.json());
server.use(cors());

server.get("/teste", (req,res)=>{
    res.json({message: "Servidor rodando com sucesso!"})
});

server.use("/api/auth", rotasAuth);

const PORT = process.env.PORT || door;
server.listen(PORT, ()=>{
    console.log(`Servidor ligado na rota http://localhost:${PORT}`);
});
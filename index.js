import express from "express";
import {pool} from "./src/config/conexao.js";
const server = express();
const door = 8080;

server.use(express.json());

server.get("/teste", (req,res)=>{
    res.json({message: "Servidor rodando com sucesso!"})
});

const PORT = process.env.PORT || door;
server.listen(PORT, ()=>{
    console.log(`Servidor ligado na rota http://localhost:${PORT}`);
});
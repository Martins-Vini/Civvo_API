import express from "express";
import {pool} from "./src/services/conexao.js";
const server = express();
const door = 8080;

server.use(express.json());

server.get("/teste", (req,res)=>{
    res.json({message: "Servidor rodando com sucesso!"})
})

server.get("/doador", async (req,res)=>{
    try{
        const conexao = await pool.getConnection();
        const [registros] = await conexao.query(`SELECT * FROM Beneficiario`)
        res.status(200).json({resultado: registros});
    }catch(error){
        console.error("Erro ao consultar doadores", error);
        res.status(500).json({error:"Erro ao consultar doadores"})
    }
})

const PORT = process.env.PORT || door;
server.listen(PORT, ()=>{
    console.log(`Servidor ligado na rota http://localhost:${PORT}`);
})
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config(); //carregar as variáveis de ambiente do .env

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conectado ao banco de dados MySQL com sucesso!');
    connection.release();
  } catch (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    process.exit(1); 
  }
}

testConnection();

export { pool };
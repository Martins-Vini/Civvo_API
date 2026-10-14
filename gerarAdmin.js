import bcrypt from 'bcrypt';
import { pool } from './src/config/conexao.js';

async function criarSuperAdmin() {
    const email = 'superadmin@civvo.org';
    const senhaPura = 'SenhaSuperAdmin123'; 
    const nomeCompleto = 'Roberto Alves';
    const cargo = 'Coordenador Geral Civvo';

    try {
        // 1. Gera o hash real do bcrypt
        const password_hash = await bcrypt.hash(senhaPura, 10);
        console.log("🔑 Hash gerado com sucesso:", password_hash);

        // 2. Remove se já existir algum admin com este e-mail
        const [userExistente] = await pool.query(`SELECT id FROM USERS WHERE email = ?`, [email]);
        
        if (userExistente.length > 0) {
            await pool.query(`DELETE FROM USERS WHERE email = ?`, [email]);
            console.log("🧹 Usuário anterior removido para atualização.");
        }

        // 3. Insere na tabela USERS sem forçar ID (deixa o AUTO_INCREMENT trabalhar)
        const [userResult] = await pool.query(
            `INSERT INTO USERS (email, password_hash, user_type, is_active) VALUES (?, ?, 'ADMIN', TRUE)`,
            [email, password_hash]
        );
        const userId = userResult.insertId;

        // 4. Insere no ADMIN_PROFILES
        await pool.query(
            `INSERT INTO ADMIN_PROFILES (user_id, nome_completo, cargo, role_level, is_active) VALUES (?, ?, ?, 'SUPER ADMIN', TRUE)`,
            [userId, nomeCompleto, cargo]
        );

        console.log(`✅ Super Admin cadastrado com sucesso! ID gerado: ${userId}`);
        console.log(`👉 Agora faça o login no Postman com:`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${senhaPura}`);

    } catch (error) {
        console.error("❌ Erro ao gerar Super Admin:", error);
    } finally {
        process.exit();
    }
}

criarSuperAdmin();
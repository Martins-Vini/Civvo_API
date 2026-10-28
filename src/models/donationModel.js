import { pool } from '../config/conexao.js';

class DonationModel {
    static async doarParaCampanha(donorId, campaignId, amount) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Valida limite máximo e mínimo da sandbox do TCC
            if (amount <= 0 || amount > 5000) {
                throw new Error("O valor da doação deve ser entre R$ 1,00 e R$ 5.000,00.");
            }

            // 1. Registra a doação como 'APROVADO' (sandbox)
            const [donationResult] = await connection.query(
                `INSERT INTO DONATIONS (donor_id, campaign_id, amount, status) VALUES (?, ?, ?, 'APROVADO')`,
                [donorId, campaignId, amount]
            );

            // 2. Atualiza o valor_atual e o status na tabela CAMPAIGN_DETAILS
            await connection.query(
                `UPDATE CAMPAIGN_DETAILS 
                 SET valor_atual = valor_atual + ?,
                     status = CASE 
                        WHEN (valor_atual + ?) >= meta_valor THEN 'ALCANÇADA'
                        ELSE 'EM_ANDAMENTO'
                     END
                 WHERE id = ?`,
                [amount, amount, campaignId]
            );

            await connection.commit();
            return donationResult.insertId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

export default DonationModel;
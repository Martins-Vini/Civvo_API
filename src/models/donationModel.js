import { pool } from '../config/conexao.js';

class DonationModel {
    static async doarParaCampanha(donorId, campaignData = {}) {
        const campaign_id = campaignData.campaign_id;
        const amount = campaignData.amount;
        const mensagem = campaignData.mensagem || "";
        const status = 'APROVADO';

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                `INSERT INTO DONATIONS (donor_id, campaign_id, amount, mensagem, status) VALUES (?, ?, ?, ?, ?)`,
                [donorId, campaign_id, amount, mensagem, status]
            );

            const donationId = result.insertId;

            if (campaign_id) {
                const [campaigns] = await connection.query(
                    `SELECT p.ong_id FROM CAMPAIGN_DETAILS cd JOIN POSTS p ON cd.post_id = p.id WHERE cd.id = ?`,
                    [campaign_id]
                );

                if (campaigns.length > 0) {
                    const ongId = campaigns[0].ong_id;
                    await connection.query(
                        `UPDATE ONGS_PROFILES SET saldo = saldo + ? WHERE id = ?`,
                        [amount, ongId]
                    );
                }

                await connection.query(
                    `UPDATE CAMPAIGN_DETAILS SET valor_atual = valor_atual + ? WHERE id = ?`,
                    [amount, campaign_id]
                );
            }

            await connection.commit();

            return {
                comprovante_id: donationId,
                valor: amount,
                mensagem: mensagem,
                status: status,
                data: new Date()
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

export default DonationModel;
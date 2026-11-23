import { pool } from '../config/conexao.js';

class DonationModel {
    /* doação: tanto para uma campanha (campaign_id) quanto direto para a ONG (ong_id, sem campanha) */
    static async doarParaCampanha(donorId, campaignData = {}) {
        const campaign_id = campaignData.campaign_id || null;
        let ong_id = campaignData.ong_id ? Number(campaignData.ong_id) : null;
        const amount = Number(campaignData.amount);
        const mensagem = campaignData.mensagem || "";
        const status = 'APROVADO';

        if (!campaign_id && !ong_id) {
            throw new Error('Informe a campanha ou a ONG para a qual deseja doar.');
        }
        if (!amount || amount <= 0) {
            throw new Error('Informe um valor de doação válido.');
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // doação para campanha: o ong_id é descoberto a partir da campanha (ignora o que vier do cliente)
            if (campaign_id) {
                const [campaigns] = await connection.query(
                    `SELECT p.ong_id FROM CAMPAIGN_DETAILS cd JOIN POSTS p ON cd.post_id = p.id WHERE cd.id = ?`,
                    [campaign_id]
                );
                if (!campaigns.length) throw new Error('Campanha não encontrada.');
                ong_id = campaigns[0].ong_id;
            } else {
                const [ongs] = await connection.query(
                    `SELECT id FROM ONGS_PROFILES WHERE id = ? AND is_active = TRUE`,
                    [ong_id]
                );
                if (!ongs.length) throw new Error('ONG não encontrada.');
            }

            const [result] = await connection.query(
                `INSERT INTO DONATIONS (donor_id, campaign_id, ong_id, amount, mensagem, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [donorId, campaign_id, ong_id, amount, mensagem, status]
            );

            const donationId = result.insertId;

            await connection.query(
                `UPDATE ONGS_PROFILES SET saldo = saldo + ? WHERE id = ?`,
                [amount, ong_id]
            );

            if (campaign_id) {
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
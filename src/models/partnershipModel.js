import { pool } from '../config/conexao.js';
import { NotificationModel } from './notificationModel.js';

/* Parceria entre ONGs: substitui o "voluntariado" quando quem quer ajudar é outra ONG.
   A ONG interessada manda um pedido (com mensagem); a ONG dona da vaga aceita ou recusa.
   Se aceitar, nasce uma publicação compartilhada (POSTS.partner_ong_id). */
export const PartnershipModel = {
    async minhaOngId(userId) {
        const [r] = await pool.query('SELECT id FROM ONGS_PROFILES WHERE user_id = ? AND is_active = TRUE', [userId]);
        return r[0]?.id ?? null;
    },

    async criarSolicitacao({ fromOngId, toOngId, postId, message }) {
        if (fromOngId === toOngId) throw new Error('Uma ONG não pode pedir parceria a si mesma.');

        const [alvo] = await pool.query('SELECT id, user_id, nome_fantasia FROM ONGS_PROFILES WHERE id = ? AND is_active = TRUE', [toOngId]);
        if (!alvo.length) throw new Error('ONG de destino não encontrada.');

        const [existente] = await pool.query(
            `SELECT id FROM PARTNERSHIP_REQUESTS WHERE from_ong_id = ? AND to_ong_id = ? AND post_id <=> ? AND status = 'PENDENTE'`,
            [fromOngId, toOngId, postId ?? null]
        );
        if (existente.length) throw new Error('Você já enviou uma solicitação de parceria para esta ONG.');

        const [result] = await pool.query(
            `INSERT INTO PARTNERSHIP_REQUESTS (from_ong_id, to_ong_id, post_id, message) VALUES (?, ?, ?, ?)`,
            [fromOngId, toOngId, postId ?? null, String(message || '').slice(0, 2000) || null]
        );

        const [solicitanteUser] = await pool.query('SELECT user_id FROM ONGS_PROFILES WHERE id = ?', [fromOngId]);
        await NotificationModel.criar({
            userId: alvo[0].user_id,
            type: 'PARCERIA_SOLICITADA',
            ongId: fromOngId,
            postId: postId ?? null,
            actorUserId: solicitanteUser[0]?.user_id ?? null,
        });

        return { id: result.insertId, fromOngId, toOngId, status: 'PENDENTE' };
    },

    async listarRecebidas(ongId) {
        const [rows] = await pool.query(
            `SELECT pr.id, pr.message, pr.status, pr.created_at, pr.post_id,
                    o.id AS ong_id, o.nome_fantasia, o.logo_url
             FROM PARTNERSHIP_REQUESTS pr
             JOIN ONGS_PROFILES o ON o.id = pr.from_ong_id
             WHERE pr.to_ong_id = ?
             ORDER BY pr.created_at DESC`,
            [ongId]
        );
        return rows;
    },

    async listarEnviadas(ongId) {
        const [rows] = await pool.query(
            `SELECT pr.id, pr.message, pr.status, pr.created_at, pr.post_id,
                    o.id AS ong_id, o.nome_fantasia, o.logo_url
             FROM PARTNERSHIP_REQUESTS pr
             JOIN ONGS_PROFILES o ON o.id = pr.to_ong_id
             WHERE pr.from_ong_id = ?
             ORDER BY pr.created_at DESC`,
            [ongId]
        );
        return rows;
    },

    /* aceitar: marca ACEITA e, se veio de uma vaga de voluntariado, publica o post compartilhado */
    async responder(requestId, ongId, aceitar) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [rows] = await conn.query(
                `SELECT * FROM PARTNERSHIP_REQUESTS WHERE id = ? AND to_ong_id = ? AND status = 'PENDENTE' FOR UPDATE`,
                [requestId, ongId]
            );
            if (!rows.length) throw new Error('Solicitação não encontrada ou já respondida.');
            const pedido = rows[0];

            await conn.query(`UPDATE PARTNERSHIP_REQUESTS SET status = ?, responded_at = NOW() WHERE id = ?`, [
                aceitar ? 'ACEITA' : 'RECUSADA',
                requestId,
            ]);

            if (aceitar && pedido.post_id) {
                await conn.query(`UPDATE POSTS SET partner_ong_id = ? WHERE id = ?`, [pedido.from_ong_id, pedido.post_id]);
            }

            const [solicitante] = await conn.query('SELECT user_id FROM ONGS_PROFILES WHERE id = ?', [pedido.from_ong_id]);
            const [respondenteUser] = await conn.query('SELECT user_id FROM ONGS_PROFILES WHERE id = ?', [ongId]);
            if (solicitante.length) {
                await conn.query(
                    `INSERT INTO NOTIFICATIONS (user_id, type, ong_id, post_id, actor_user_id) VALUES (?, ?, ?, ?, ?)`,
                    [solicitante[0].user_id, aceitar ? 'PARCERIA_ACEITA' : 'PARCERIA_RECUSADA', ongId, pedido.post_id, respondenteUser[0]?.user_id ?? null]
                );
            }

            await conn.commit();
            return { id: requestId, status: aceitar ? 'ACEITA' : 'RECUSADA' };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    },
};

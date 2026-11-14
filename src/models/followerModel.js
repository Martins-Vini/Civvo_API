import { pool } from '../config/conexao.js';

export const FollowerModel = {
    async follow(followerId, followingId) {
        const [result] = await pool.query(
            'INSERT INTO USER_FOLLOWERS (follower_id, following_id) VALUES (?, ?)',
            [followerId, followingId]
        );
        return result.insertId;
    },

    async unfollow(followerId, followingId) {
        const [result] = await pool.query(
            'DELETE FROM USER_FOLLOWERS WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId]
        );
        return result.affectedRows > 0;
    },

    async getFollowers(userId) {
        const [rows] = await pool.query(
            `SELECT u.id, u.email, u.user_type FROM USER_FOLLOWERS f
             JOIN USERS u ON f.follower_id = u.id WHERE f.following_id = ?`,
            [userId]
        );
        return rows;
    },

    async getFollowing(userId) {
        const [rows] = await pool.query(
            `SELECT u.id, u.email, u.user_type FROM USER_FOLLOWERS f
             JOIN USERS u ON f.following_id = u.id WHERE f.follower_id = ?`,
            [userId]
        );
        return rows;
    },

    /* O front trabalha com o id do PERFIL da ONG (ONGS_PROFILES.id = POSTS.ong_id);
       a tabela USER_FOLLOWERS guarda USERS.id. A conversão é feita aqui. */
    async toggleOng(followerUserId, ongProfileId) {
        const [ongs] = await pool.query(
            'SELECT user_id FROM ONGS_PROFILES WHERE id = ? AND is_active = TRUE',
            [ongProfileId]
        );
        if (!ongs.length) return { notFound: true };

        const ongUserId = ongs[0].user_id;
        if (Number(ongUserId) === Number(followerUserId)) return { self: true };

        /* quem está seguindo precisa existir em USERS (senão o INSERT falharia) */
        const [quem] = await pool.query('SELECT id FROM USERS WHERE id = ?', [followerUserId]);
        if (!quem.length) return { sessaoInvalida: true };

        const [del] = await pool.query(
            'DELETE FROM USER_FOLLOWERS WHERE follower_id = ? AND following_id = ?',
            [followerUserId, ongUserId]
        );

        let following = false;
        if (del.affectedRows === 0) {
            try {
                await pool.query(
                    'INSERT INTO USER_FOLLOWERS (follower_id, following_id) VALUES (?, ?)',
                    [followerUserId, ongUserId]
                );
            } catch (e) {
                /* duplicado = já seguia (clique duplo); qualquer outro erro aparece de verdade */
                if (e.code !== 'ER_DUP_ENTRY') throw e;
            }
            following = true;
        }

        const [count] = await pool.query(
            'SELECT COUNT(*) AS total FROM USER_FOLLOWERS WHERE following_id = ?',
            [ongUserId]
        );

        return { following, seguidores: count[0].total };
    },

    /* contadores do perfil de uma ONG */
    async contagensOng(ongProfileId) {
        const [rows] = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM USER_FOLLOWERS WHERE following_id = o.user_id) AS seguidores,
                (SELECT COUNT(*) FROM USER_FOLLOWERS WHERE follower_id = o.user_id) AS seguindo
             FROM ONGS_PROFILES o WHERE o.id = ?`,
            [ongProfileId]
        );
        return rows[0] || null;
    },

    /* lista no estilo "Seguidores / Seguindo" do Instagram.
       tipo = 'seguidores' (quem segue o usuário) ou 'seguindo' (quem o usuário segue) */
    async listarPorUsuario(userId, tipo) {
        const [meuLado, outroLado] = tipo === 'seguidores'
            ? ['following_id', 'follower_id']
            : ['follower_id', 'following_id'];

        const [rows] = await pool.query(
            `SELECT u.id AS user_id, u.user_type, op.id AS ong_id,
                    COALESCE(op.nome_fantasia, CONCAT(dp.nome, ' ', dp.sobrenome), 'Usuário Civvo') AS nome,
                    dp.apelido_unico AS apelido,
                    COALESCE(op.logo_url, dp.avatar_url) AS avatar
             FROM USER_FOLLOWERS f
             JOIN USERS u ON u.id = f.${outroLado}
             LEFT JOIN ONGS_PROFILES op ON op.user_id = u.id
             LEFT JOIN DOADORES_PROFILES dp ON dp.user_id = u.id
             WHERE f.${meuLado} = ?
             ORDER BY f.created_at DESC, f.id DESC
             LIMIT 200`,
            [userId]
        );
        return rows;
    },

    async userIdDaOng(ongProfileId) {
        const [rows] = await pool.query('SELECT user_id FROM ONGS_PROFILES WHERE id = ?', [ongProfileId]);
        return rows.length ? rows[0].user_id : null;
    },

    /* ids (ONGS_PROFILES.id) das ONGs que o usuário segue */
    async listOngsSeguidas(userId) {
        const [rows] = await pool.query(
            `SELECT o.id FROM USER_FOLLOWERS f
             JOIN ONGS_PROFILES o ON o.user_id = f.following_id
             WHERE f.follower_id = ?`,
            [userId]
        );
        return rows.map((r) => r.id);
    }
};
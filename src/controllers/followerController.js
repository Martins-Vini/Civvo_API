import { FollowerModel } from '../models/followerModel.js';

/* Lê o id do usuário (USERS.id) que o middleware de token colocou na requisição.
   Aceita os nomes mais comuns; se nenhum vier, registra no terminal o que o token trouxe. */
export const idDoUsuario = (req) => {
    const bruto = req.user?.id ?? req.user?.userId ?? req.user?.user_id ?? req.userId ?? req.usuario?.id;
    const id = Number(bruto);
    if (!Number.isInteger(id) || id <= 0) {
        console.error('[followers] Não achei o id do usuário no token. req.user =', req.user);
        return null;
    }
    return id;
};

export const FollowerController = {
    async followUser(req, res) {
        try {
            const followerId = req.user.id; // Assume middleware JWT pré-existente
            const { followingId } = req.body;

            if (followerId === Number(followingId)) {
                return res.status(400).json({ error: 'Você não pode seguir a si mesmo.' });
            }

            await FollowerModel.follow(followerId, followingId);
            return res.status(201).json({ message: 'Seguido com sucesso!' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    async unfollowUser(req, res) {
        try {
            const followerId = req.user.id;
            const { followingId } = req.params;

            await FollowerModel.unfollow(followerId, followingId);
            return res.status(200).json({ message: 'Deixou de seguir com sucesso.' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    async listFollowers(req, res) {
        try {
            const { userId } = req.params;
            const followers = await FollowerModel.getFollowers(userId);
            return res.json(followers);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    async listFollowing(req, res) {
        try {
            const { userId } = req.params;
            const following = await FollowerModel.getFollowing(userId);
            return res.json(following);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    /* POST /followers/toggle  { ongId }  → { following, seguidores } */
    async toggleOng(req, res) {
        try {
            const ongId = Number(req.body?.ongId);
            if (!Number.isInteger(ongId) || ongId <= 0) {
                return res.status(400).json({ error: 'ONG inválida.' });
            }

            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });

            const r = await FollowerModel.toggleOng(uid, ongId);
            if (r.sessaoInvalida) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
            if (r.notFound) return res.status(404).json({ error: 'ONG não encontrada.' });
            if (r.self) return res.status(400).json({ error: 'Você não pode seguir a si mesmo.' });

            return res.json({ following: r.following, seguidores: r.seguidores });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    /* GET /followers/ong/:ongId/contagens → { seguidores, seguindo } */
    async contagensOng(req, res) {
        try {
            const c = await FollowerModel.contagensOng(Number(req.params.ongId));
            if (!c) return res.status(404).json({ error: 'ONG não encontrada.' });
            return res.json({ seguidores: c.seguidores, seguindo: c.seguindo });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    /* GET /followers/ong/:ongId/:tipo   (tipo = seguidores | seguindo) */
    async listaOng(req, res) {
        try {
            const { tipo } = req.params;
            if (tipo !== 'seguidores' && tipo !== 'seguindo') {
                return res.status(400).json({ error: 'Tipo de lista inválido.' });
            }
            const userId = await FollowerModel.userIdDaOng(Number(req.params.ongId));
            if (!userId) return res.status(404).json({ error: 'ONG não encontrada.' });
            return res.json(await FollowerModel.listarPorUsuario(userId, tipo));
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    /* GET /followers/me/seguindo → quem eu sigo (com nome e foto) */
    async minhaListaSeguindo(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
            return res.json(await FollowerModel.listarPorUsuario(uid, 'seguindo'));
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    /* GET /followers/me/ongs  → [ongId, ...] */
    async minhasOngs(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
            const ids = await FollowerModel.listOngsSeguidas(uid);
            return res.json(ids);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
};
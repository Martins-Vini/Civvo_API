import { FollowerModel } from '../models/followerModel.js';

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
    }
};
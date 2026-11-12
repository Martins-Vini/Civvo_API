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
    }
};
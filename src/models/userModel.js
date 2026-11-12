import { pool } from '../config/conexao.js';

export const UserModel = {
    async deleteUserAccount(userId) {
        const [result] = await pool.query(
            'UPDATE USERS SET is_active = FALSE WHERE id = ?',
            [userId]
        );
        return result.affectedRows > 0;
    }
};
import { NotificationModel } from '../models/notificationModel.js';
import { idDoUsuario } from './followerController.js';

export const NotificationController = {
    async listar(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
            return res.json(await NotificationModel.listar(uid));
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    async marcarLidas(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
            await NotificationModel.marcarTodasLidas(uid);
            return res.json({ message: 'Notificações marcadas como lidas.' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
};
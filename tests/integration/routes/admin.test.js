import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
const AdminModel = { buscarPorEmail: jest.fn(), criarNovoAdmin: jest.fn() };
jest.unstable_mockModule('../../../src/models/adminModel.js', () => ({ AdminModel }));
const { AdminController } = await import('../../../src/controllers/adminController.js');
const { verificarAdmin } = await import('../../../src/middlewares/authAdminMiddleware.js');
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
describe('AdminController e verificarAdmin', () => {
 beforeEach(() => { jest.clearAllMocks(); process.env.JWT_SECRET = 'test-secret'; });
 test('faz login administrativo e devolve JWT', async () => { AdminModel.buscarPorEmail.mockResolvedValue({ id: 1, admin_profile_id: 2, user_type: 'ADMIN', role_level: 'SUPER ADMIN', cargo: 'Diretor', nome_completo: 'Admin', password_hash: 'hash' }); const bcrypt = await import('bcrypt'); jest.spyOn(bcrypt.default, 'compare').mockResolvedValue(true); const res = response(); await AdminController.entrarAdmin({ body: { email: 'admin@civvo.org', password: 'senha' } }, res); expect(res.status).toHaveBeenCalledWith(200); expect(res.json.mock.calls[0][0].token).toEqual(expect.any(String)); });
 test('recusa token ausente e token de usuário comum', () => { const res = response(); const next = jest.fn(); verificarAdmin()({ headers: {} }, res, next); expect(res.status).toHaveBeenCalledWith(401); const token = jwt.sign({ userType: 'DOADOR' }, 'test-secret'); const res2 = response(); verificarAdmin()({ headers: { authorization: `Bearer ${token}` } }, res2, next); expect(res2.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled(); });
});

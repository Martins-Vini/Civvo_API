import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

const pool = { query: jest.fn() };
jest.unstable_mockModule('../../src/config/conexao.js', () => ({ pool }));
const { verificarToken, somenteOngs } = await import('../../src/middlewares/authMiddleware.js');
const { verificarAutenticacaoOng } = await import('../../src/middlewares/authOngMiddleware.js');
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

describe('middlewares de autenticação', () => {
  beforeEach(() => { jest.clearAllMocks(); process.env.JWT_SECRET = 'test-secret'; });

  test('verificarToken rejeita ausência e aceita token válido', () => {
    const res = response(); const next = jest.fn();
    verificarToken({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    const token = jwt.sign({ userId: 3, userType: 'DOADOR' }, 'test-secret');
    verificarToken({ headers: { authorization: `Bearer ${token}` } }, response(), next);
    expect(next).toHaveBeenCalled();
  });

  test('somenteOngs rejeita doador', async () => {
    const res = response(); const next = jest.fn();
    await somenteOngs({ user: { userType: 'DOADOR' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('verificarAutenticacaoOng injeta dados do token', () => {
    const token = jwt.sign({ userId: 4, userType: 'ONG', ongProfileId: 8 }, 'test-secret');
    const req = { headers: { authorization: `Bearer ${token}` } }; const next = jest.fn();
    verificarAutenticacaoOng(req, response(), next);
    expect(next).toHaveBeenCalled();
    expect(req).toMatchObject({ userId: 4, ongProfileId: 8, userType: 'ONG' });
  });
});

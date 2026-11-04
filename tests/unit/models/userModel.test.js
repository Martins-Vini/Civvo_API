import { jest, describe, test, expect, beforeEach } from '@jest/globals';
const connection = { beginTransaction: jest.fn(), query: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
const pool = { getConnection: jest.fn(), query: jest.fn() };
jest.unstable_mockModule('../../../src/config/conexao.js', () => ({ pool }));
const { default: DoadorModel } = await import('../../../src/models/donorModel.js');
describe('DoadorModel', () => {
 beforeEach(() => { jest.clearAllMocks(); pool.getConnection.mockResolvedValue(connection); connection.query.mockResolvedValueOnce([{ insertId: 31 }]).mockResolvedValueOnce([{}]); });
 test('cria usuário e perfil e confirma transação', async () => { await expect(DoadorModel.create({ email: 'a@b.com', password_hash: 'hash' }, { nome: 'Ana', sobrenome: 'Silva', apelido_unico: 'ana', cpf: '1' })).resolves.toBe(31); expect(connection.query).toHaveBeenCalledTimes(2); expect(connection.commit).toHaveBeenCalled(); });
 test('procura doador por e-mail', async () => { const user = { id: 31, email: 'a@b.com', user_type: 'DOADOR' }; pool.query.mockResolvedValue([[user]]); await expect(DoadorModel.findByEmail('a@b.com')).resolves.toEqual(user); });
 test('faz rollback se perfil falhar', async () => { connection.query.mockReset(); connection.query.mockResolvedValueOnce([{ insertId: 31 }]).mockRejectedValueOnce(new Error('insert failed')); await expect(DoadorModel.create({ email: 'a@b.com', password_hash: 'hash' }, { nome: 'Ana' })).rejects.toThrow('insert failed'); expect(connection.rollback).toHaveBeenCalled(); });
});

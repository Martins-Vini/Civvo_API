import { jest, describe, test, expect, beforeEach } from '@jest/globals';
const connection = { beginTransaction: jest.fn(), query: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
const pool = { getConnection: jest.fn() };
jest.unstable_mockModule('../../../src/config/conexao.js', () => ({ pool }));
const { default: DonationModel } = await import('../../../src/models/donationModel.js');
describe('DonationModel.doarParaCampanha', () => {
 beforeEach(() => { jest.clearAllMocks(); pool.getConnection.mockResolvedValue(connection); connection.query.mockResolvedValue([{ insertId: 42 }]); });
 test('registra doação válida e confirma transação', async () => { await expect(DonationModel.doarParaCampanha(7, 9, 150)).resolves.toBe(42); expect(connection.beginTransaction).toHaveBeenCalled(); expect(connection.query).toHaveBeenCalledTimes(2); expect(connection.commit).toHaveBeenCalled(); expect(connection.rollback).not.toHaveBeenCalled(); expect(connection.release).toHaveBeenCalled(); });
 test.each([0, -1, 5000.01])('recusa valor %s', async amount => { await expect(DonationModel.doarParaCampanha(7, 9, amount)).rejects.toThrow('O valor da doação deve ser entre R$ 1,00 e R$ 5.000,00.'); expect(connection.query).not.toHaveBeenCalled(); expect(connection.rollback).toHaveBeenCalled(); });
 test('faz rollback quando query falha', async () => { connection.query.mockRejectedValueOnce(new Error('database unavailable')); await expect(DonationModel.doarParaCampanha(7, 9, 10)).rejects.toThrow('database unavailable'); expect(connection.rollback).toHaveBeenCalled(); expect(connection.commit).not.toHaveBeenCalled(); });
});

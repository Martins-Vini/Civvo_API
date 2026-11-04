import { jest, describe, test, expect, beforeEach } from '@jest/globals';
const pool = { query: jest.fn() };
jest.unstable_mockModule('../../../src/config/conexao.js', () => ({ pool }));
const { default: MomentModel } = await import('../../../src/models/momentModel.js');
describe('MomentModel', () => {
 beforeEach(() => jest.clearAllMocks());
 test('cria momento e retorna insertId', async () => { pool.query.mockResolvedValue([{ insertId: 15 }]); await expect(MomentModel.create(3, 'media', 'Legenda', 48)).resolves.toBe(15); expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO MOMENTS'), [3, 'media', 'Legenda', 48]); });
 test('usa legenda nula e 24 horas por padrão', async () => { pool.query.mockResolvedValue([{ insertId: 16 }]); await MomentModel.create(3, 'media', undefined); expect(pool.query).toHaveBeenCalledWith(expect.any(String), [3, 'media', null, 24]); });
 test('lista momentos ativos', async () => { const rows = [{ id: 1, is_active: true }]; pool.query.mockResolvedValue([rows]); await expect(MomentModel.listarAtivos()).resolves.toEqual(rows); expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('expires_at > NOW()')); });
});

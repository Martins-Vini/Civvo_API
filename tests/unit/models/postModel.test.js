import { jest, describe, test, expect, beforeEach } from '@jest/globals';
const connection = { beginTransaction: jest.fn(), query: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
const pool = { getConnection: jest.fn(), query: jest.fn() };
jest.unstable_mockModule('../../../src/config/conexao.js', () => ({ pool }));
const { default: PostModel } = await import('../../../src/models/postModel.js');
describe('PostModel', () => {
 beforeEach(() => { jest.clearAllMocks(); pool.getConnection.mockResolvedValue(connection); });
 test('cria post de campanha, mídia e detalhes', async () => { connection.query.mockResolvedValueOnce([{ insertId: 20 }]).mockResolvedValue({}); await expect(PostModel.createPost(4, { type: 'CAMPANHA', caption: 'Ajude', is_boosted: false }, [{ file_url: 'x', media_type: 'image' }], { meta_valor: 1000, data_limite: '2030-01-01' })).resolves.toBe(20); expect(connection.query).toHaveBeenCalledTimes(3); expect(connection.commit).toHaveBeenCalled(); });
 test('recusa denúncia sem motivo ou acima de 225 caracteres', async () => { await expect(PostModel.reportPost(1, 2, '')).rejects.toThrow('O motivo da denúncia deve ter no máximo 225 caracteres.'); await expect(PostModel.reportPost(1, 2, 'x'.repeat(226))).rejects.toThrow('O motivo da denúncia deve ter no máximo 225 caracteres.'); expect(pool.query).not.toHaveBeenCalled(); });
 test('alterna curtida', async () => { pool.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{}]); await expect(PostModel.toggleLike(3, 8)).resolves.toEqual({ liked: true }); pool.query.mockResolvedValueOnce([[{ id: 1 }]]).mockResolvedValueOnce([{}]); await expect(PostModel.toggleLike(3, 8)).resolves.toEqual({ liked: false }); });
 test('recusa candidatura sem vaga', async () => { connection.query.mockResolvedValueOnce([[]]); await expect(PostModel.applyVolunteer(2, 5)).rejects.toThrow('Vaga de voluntariado não encontrada.'); expect(connection.rollback).toHaveBeenCalled(); });
});

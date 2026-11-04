import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { validarAlgoritmoCnpj, consultarCnpj } from '../../../src/services/cnpjService.js';
describe('KYB e serviço de CNPJ', () => {
 beforeEach(() => jest.restoreAllMocks());
 test.each(['11.222.333/0001-81', '11222333000181'])('aceita CNPJ válido: %s', cnpj => expect(validarAlgoritmoCnpj(cnpj)).toBe(true));
 test.each(['11.222.333/0001-80', '00000000000000', '123'])('recusa CNPJ inválido: %s', cnpj => expect(validarAlgoritmoCnpj(cnpj)).toBe(false));
 test('normaliza dados da Receita', async () => { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ razao_social: 'ONG Teste', nome_fantasia: 'Teste', cnae_fiscal: 9499500, logradouro: 'Rua A', bairro: 'Centro', municipio: 'São Paulo', uf: 'SP', cep: '01.000-000', descricao_situacao_cadastral: 'ATIVA' }) }); await expect(consultarCnpj('11.222.333/0001-81')).resolves.toMatchObject({ razao_social: 'ONG Teste', cnae: '9499-5/00', cidade: 'São Paulo', estado: 'SP', cep: '01000000' }); });
 test('não consulta API para CNPJ inválido', async () => { global.fetch = jest.fn(); await expect(consultarCnpj('123')).rejects.toThrow('CNPJ matematicamente inválido'); expect(global.fetch).not.toHaveBeenCalled(); });
});

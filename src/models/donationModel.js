import { pool } from '../config/conexao.js';
import * as gateway from '../services/paymentGatewayService.js';

export class DonationError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'DonationError';
        this.status = status;
    }
}

const VALOR_MIN = 1;
const VALOR_MAX = 50000;
const MSG_MAX = 500;
/* o Mercado Pago exige prazo mínimo para o Pix (30 min): com exatamente 30 a cobrança pode ser recusada */
const EXPIRA_MIN = () => Number(process.env.DONATION_PIX_EXPIRES_MIN) || 60;

/* última conferência no gateway por doação (para o polling do front não martelar a API do gateway) */
const ULTIMA_CONFERENCIA = new Map();

function cpfValido(cpf) {
    const d = String(cpf || '').replace(/\D/g, '');
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (const t of [9, 10]) {
        let soma = 0;
        for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
        if (((soma * 10) % 11) % 10 !== Number(d[t])) return false;
    }
    return true;
}

const mascararCpf = (cpf) => {
    const d = String(cpf || '').replace(/\D/g, '');
    return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : '';
};

const SELECT_DOACAO = `
    SELECT d.id, d.donor_id, d.status, d.amount, d.metodo_pagamento, d.cpf_doador, d.mensagem,
           d.created_at, d.paid_at, d.expires_at, d.pix_copia_e_cola, d.pix_qr_base64, d.checkout_url,
           d.ong_id, d.campaign_id, d.gateway_payment_id,
           o.nome_fantasia AS ong_nome, p.id AS post_id, LEFT(p.caption, 60) AS projeto
    FROM DONATIONS d
    LEFT JOIN ONGS_PROFILES o ON o.id = d.ong_id
    LEFT JOIN CAMPAIGN_DETAILS cd ON cd.id = d.campaign_id
    LEFT JOIN POSTS p ON p.id = cd.post_id`;

/* linha do banco -> JSON que o front lê (ver adaptDoacaoApi no front) */
function formatar(r, incluirPagamento = false) {
    const out = {
        id: r.id,
        status: r.status,
        valor: Number(r.amount),
        metodo: r.metodo_pagamento,
        created_at: r.created_at,
        paid_at: r.paid_at,
        expires_at: r.expires_at,
        projeto: r.projeto || (r.campaign_id ? 'Campanha' : 'Doação direta'),
        ong_nome: r.ong_nome || '',
        ong_id: r.ong_id,
        post_id: r.post_id ?? null,
        cpf_mascarado: mascararCpf(r.cpf_doador),
        mensagem: r.mensagem || ''
    };

    /* os dados de pagamento só aparecem enquanto a doação espera pagamento */
    if (incluirPagamento && r.status === 'PENDENTE') {
        if (r.metodo_pagamento === 'PIX' && r.pix_copia_e_cola) {
            out.pix = {
                copia_e_cola: r.pix_copia_e_cola,
                qr_code_base64: r.pix_qr_base64 || '',
                expires_at: r.expires_at
            };
        }
        if (r.checkout_url) out.checkout_url = r.checkout_url;
    }
    return out;
}

/* resposta de criação: { donation, pix?, checkout_url? } */
function respostaCriacao(r) {
    const d = formatar(r, true);
    const { pix, checkout_url, ...donation } = d;
    return { donation, ...(pix ? { pix } : {}), ...(checkout_url ? { checkout_url } : {}) };
}

class DonationModel {
    /* ---------------------------------------------------------------- criar */
    static async criar(donorId, dados = {}) {
        const campaignId = dados.campaign_id ? Number(dados.campaign_id) : null;
        let ongId = dados.ong_id ? Number(dados.ong_id) : null;
        const valor = Number(dados.amount);
        const metodo = String(dados.metodo || 'PIX').toUpperCase();
        const cpf = String(dados.cpf || '').replace(/\D/g, '');
        const mensagem = String(dados.mensagem || '').trim();
        const chave = dados.idempotency_key ? String(dados.idempotency_key) : null;

        if (!campaignId && !ongId) throw new DonationError(400, 'Informe a campanha ou a ONG para a qual deseja doar.');
        if (!Number.isFinite(valor) || valor <= 0) throw new DonationError(400, 'Informe um valor de doação válido.');
        if (valor < VALOR_MIN || valor > VALOR_MAX) {
            throw new DonationError(400, 'O valor da doação deve ser entre R$ 1,00 e R$ 50.000,00.');
        }
        if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-6) {
            throw new DonationError(400, 'Use no máximo 2 casas decimais no valor.');
        }
        if (!['PIX', 'CARTAO'].includes(metodo)) throw new DonationError(400, 'Forma de pagamento inválida.');
        if (!cpfValido(cpf)) throw new DonationError(400, 'Informe um CPF válido, com 11 dígitos.');
        if (mensagem.length > MSG_MAX) throw new DonationError(400, `A mensagem pode ter até ${MSG_MAX} caracteres.`);
        if (chave && !/^[A-Za-z0-9_-]{8,64}$/.test(chave)) throw new DonationError(400, 'Chave de idempotência inválida.');

        /* só conta de doador doa */
        const [doadores] = await pool.query(
            `SELECT u.user_type, u.email, dp.nome, dp.sobrenome
             FROM USERS u LEFT JOIN DOADORES_PROFILES dp ON dp.user_id = u.id
             WHERE u.id = ? AND u.is_active = TRUE`,
            [donorId]
        );
        if (!doadores.length) throw new DonationError(401, 'Conta desativada ou inexistente.');
        if (doadores[0].user_type !== 'DOADOR') {
            throw new DonationError(403, 'Somente contas de doador podem fazer doações.');
        }
        const doador = doadores[0];

        /* mesma chave do mesmo doador = devolve a doação já criada (não cobra duas vezes) */
        if (chave) {
            const [ja] = await pool.query(`SELECT id FROM DONATIONS WHERE donor_id = ? AND idempotency_key = ?`, [donorId, chave]);
            if (ja.length) return DonationModel.#respostaDe(donorId, ja[0].id);
        }

        const agora = new Date();

        if (campaignId) {
            const [camps] = await pool.query(
                `SELECT cd.status, cd.data_limite, p.ong_id
                 FROM CAMPAIGN_DETAILS cd
                 JOIN POSTS p ON p.id = cd.post_id
                 JOIN ONGS_PROFILES o ON o.id = p.ong_id
                 WHERE cd.id = ? AND cd.is_active = TRUE AND p.is_active = TRUE AND o.is_active = TRUE`,
                [campaignId]
            );
            if (!camps.length) throw new DonationError(404, 'Campanha não encontrada.');
            if (camps[0].status === 'ENCERRADA') throw new DonationError(409, 'Esta campanha foi encerrada e não recebe mais doações.');
            if (camps[0].data_limite && new Date(camps[0].data_limite) < agora) {
                throw new DonationError(409, 'O prazo desta campanha terminou e ela não recebe mais doações.');
            }
            ongId = camps[0].ong_id; /* ignora o ong_id vindo do cliente */
        } else {
            const [ongs] = await pool.query(`SELECT id FROM ONGS_PROFILES WHERE id = ? AND is_active = TRUE`, [ongId]);
            if (!ongs.length) throw new DonationError(404, 'ONG não encontrada.');
        }

        const expiraEm = new Date(agora.getTime() + EXPIRA_MIN() * 60 * 1000);

        let donationId;
        try {
            const [ins] = await pool.query(
                `INSERT INTO DONATIONS
                    (donor_id, campaign_id, ong_id, amount, metodo_pagamento, cpf_doador, idempotency_key, mensagem, status, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', ?)`,
                [donorId, campaignId, ongId, valor, metodo, cpf, chave, mensagem, expiraEm]
            );
            donationId = ins.insertId;
        } catch (e) {
            /* duas requisições com a mesma chave ao mesmo tempo: vale a que entrou primeiro */
            if (e.code === 'ER_DUP_ENTRY' && chave) {
                const [ja] = await pool.query(`SELECT id FROM DONATIONS WHERE donor_id = ? AND idempotency_key = ?`, [donorId, chave]);
                if (ja.length) return DonationModel.#respostaDe(donorId, ja[0].id);
            }
            throw e;
        }

        /* cobrança no gateway (fora de transação: é uma chamada de rede) */
        try {
            const nome = [doador.nome, doador.sobrenome].filter(Boolean).join(' ') || 'Doador';
            const c = await gateway.criarCobranca({
                id: donationId,
                valor,
                metodo,
                cpf,
                email: doador.email,
                nome,
                descricao: 'Doação via Civvo',
                expiraEm
            });

            await pool.query(
                `UPDATE DONATIONS
                    SET gateway_provider = ?, gateway_payment_id = ?, pix_copia_e_cola = ?, pix_qr_base64 = ?,
                        checkout_url = ?, expires_at = COALESCE(?, expires_at)
                  WHERE id = ?`,
                [
                    gateway.nomeProvedor(),
                    c.paymentId,
                    c.pix?.copia_e_cola || null,
                    c.pix?.qr_code_base64 || null,
                    c.checkoutUrl || null,
                    c.pix?.expires_at ? new Date(c.pix.expires_at) : null,
                    donationId
                ]
            );
        } catch (e) {
            console.error(`Falha ao criar cobrança no gateway (doação ${donationId}, referência ${gateway.referenciaDaDoacao(donationId)}):`, e.message);
            /* nada foi cobrado: apaga o registro para a mesma chave poder tentar de novo.
               Se a cobrança chegou a ser criada e só a resposta se perdeu, o aviso de pagamento dela
               cai em "doação inexistente" e é registrado no log (ver aplicarPagamento). */
            await pool.query(`DELETE FROM DONATIONS WHERE id = ? AND status = 'PENDENTE'`, [donationId]);
            throw new DonationError(502, 'Não foi possível gerar o pagamento agora. Tente novamente em instantes.');
        }

        return DonationModel.#respostaDe(donorId, donationId);
    }

    static async #respostaDe(donorId, id) {
        const [rows] = await pool.query(`${SELECT_DOACAO} WHERE d.id = ? AND d.donor_id = ?`, [id, donorId]);
        return respostaCriacao(rows[0]);
    }

    /* ---------------------------------------------------------------- leitura */
    static async buscar(donorId, id) {
        let [rows] = await pool.query(`${SELECT_DOACAO} WHERE d.id = ? AND d.donor_id = ?`, [id, donorId]);
        if (!rows.length) throw new DonationError(404, 'Comprovante não encontrado.');

        /* webhook atrasado/perdido (ou sem URL pública em desenvolvimento): confere no gateway,
           no máximo 1 vez a cada 15 s por doação */
        if (rows[0].status === 'PENDENTE' && rows[0].gateway_payment_id && !gateway.ehMock()) {
            await DonationModel.conferirComLimite(rows[0].id);
            [rows] = await pool.query(`${SELECT_DOACAO} WHERE d.id = ? AND d.donor_id = ?`, [id, donorId]);
        }

        /* Pix vencido e ainda pendente: marca como expirado já na consulta */
        const r = rows[0];
        if (r.status === 'PENDENTE' && r.expires_at && new Date(r.expires_at) < new Date()) {
            await DonationModel.aplicarStatus(r.id, 'EXPIRADO');
            [rows] = await pool.query(`${SELECT_DOACAO} WHERE d.id = ? AND d.donor_id = ?`, [id, donorId]);
        }
        return formatar(rows[0], true);
    }

    static async minhas(donorId) {
        const [rows] = await pool.query(
            `${SELECT_DOACAO} WHERE d.donor_id = ? ORDER BY d.created_at DESC, d.id DESC LIMIT 100`,
            [donorId]
        );
        return rows.map((r) => formatar(r, false));
    }

    /* ---------------------------------------------------------------- mudança de status
       É AQUI (e só aqui) que o dinheiro entra no saldo da ONG e na barra da campanha.
       Idempotente: chamar duas vezes com o mesmo status não credita duas vezes. */
    static async aplicarStatus(donationId, novoStatus) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [rows] = await conn.query(
                `SELECT id, status, amount, campaign_id, ong_id FROM DONATIONS WHERE id = ? FOR UPDATE`,
                [donationId]
            );
            if (!rows.length) {
                await conn.rollback();
                return { encontrada: false, mudou: false };
            }

            const d = rows[0];
            const valor = Number(d.amount);
            const agora = new Date();
            let mudou = false;

            if (novoStatus === 'APROVADO' && ['PENDENTE', 'EXPIRADO', 'REJEITADO'].includes(d.status)) {
                await conn.query(`UPDATE DONATIONS SET status = 'APROVADO', paid_at = ? WHERE id = ?`, [agora, d.id]);

                if (d.ong_id) {
                    await conn.query(`UPDATE ONGS_PROFILES SET saldo = saldo + ? WHERE id = ?`, [valor, d.ong_id]);
                }
                if (d.campaign_id) {
                    /* status vem ANTES de valor_atual: o MySQL calcula o SET da esquerda para a direita */
                    await conn.query(
                        `UPDATE CAMPAIGN_DETAILS
                            SET status = CASE WHEN status = 'EM_ANDAMENTO' AND valor_atual + ? >= meta_valor
                                              THEN 'ALCANÇADA' ELSE status END,
                                valor_atual = valor_atual + ?
                          WHERE id = ?`,
                        [valor, valor, d.campaign_id]
                    );
                }
                mudou = true;
            } else if (novoStatus === 'ESTORNADO' && d.status === 'APROVADO') {
                await conn.query(`UPDATE DONATIONS SET status = 'ESTORNADO' WHERE id = ?`, [d.id]);

                if (d.ong_id) {
                    await conn.query(`UPDATE ONGS_PROFILES SET saldo = saldo - ? WHERE id = ?`, [valor, d.ong_id]);
                }
                if (d.campaign_id) {
                    /* aqui valor_atual vem primeiro de propósito: o status usa o valor já descontado */
                    await conn.query(
                        `UPDATE CAMPAIGN_DETAILS
                            SET valor_atual = GREATEST(valor_atual - ?, 0),
                                status = CASE WHEN status = 'ALCANÇADA' AND valor_atual < meta_valor
                                              THEN 'EM_ANDAMENTO' ELSE status END
                          WHERE id = ?`,
                        [valor, d.campaign_id]
                    );
                }
                mudou = true;
            } else if ((novoStatus === 'REJEITADO' || novoStatus === 'EXPIRADO') && d.status === 'PENDENTE') {
                await conn.query(`UPDATE DONATIONS SET status = ? WHERE id = ?`, [novoStatus, d.id]);
                mudou = true;
            }

            await conn.commit();
            return { encontrada: true, mudou, statusAnterior: d.status };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    /* ---------------------------------------------------------------- webhook
       Não confiamos no corpo do aviso: ele só diz "o pagamento X mudou".
       O status verdadeiro é consultado direto na API do gateway. */
    static async sincronizarComGateway({ eventId, paymentId }) {
        const pag = await gateway.consultarPagamento(paymentId);
        return DonationModel.aplicarPagamento(pag, eventId);
    }

    /* confere uma doação pendente consultando o gateway pela referência */
    static async conferirNoGateway(donationId) {
        const pag = await gateway.consultarPorReferencia(gateway.referenciaDaDoacao(donationId));
        return DonationModel.aplicarPagamento(pag, null);
    }

    static async conferirComLimite(donationId) {
        const agora = Date.now();
        if (agora - (ULTIMA_CONFERENCIA.get(donationId) || 0) < 15000) return;
        ULTIMA_CONFERENCIA.set(donationId, agora);
        try {
            await DonationModel.conferirNoGateway(donationId);
        } catch (e) {
            console.error(`Falha ao conferir a doação ${donationId} no gateway:`, e.message);
        }
    }

    /* aplica no banco o que o gateway diz (status verdadeiro, vindo da API dele) */
    static async aplicarPagamento(pag, eventId) {
        if (!pag || !pag.externalReference) return { ignorado: true };

        const donationId = gateway.idDaReferencia(pag.externalReference);
        if (!donationId) return { ignorado: true };

        const [rows] = await pool.query(`SELECT id, amount, gateway_payment_id FROM DONATIONS WHERE id = ?`, [donationId]);
        if (!rows.length) {
            /* ex.: a cobrança foi criada no gateway mas o registro foi apagado por falha na criação */
            console.error(`ATENÇÃO: pagamento ${pag.paymentId} (${pag.status}) sem doação correspondente (${pag.externalReference}). Verifique manualmente.`);
            return { ignorado: true };
        }

        /* valor pago diferente do valor da doação: não credita, só registra */
        if (pag.valor != null && Math.abs(pag.valor - Number(rows[0].amount)) > 0.009) {
            console.error(`Webhook: valor divergente na doação ${donationId} (gateway ${pag.valor} x banco ${rows[0].amount}).`);
            return { ignorado: true };
        }

        /* cartão: o id guardado era o da preferência; passa a ser o do pagamento real */
        if (pag.paymentId && pag.paymentId !== String(rows[0].gateway_payment_id)) {
            await pool
                .query(`UPDATE DONATIONS SET gateway_payment_id = ? WHERE id = ?`, [pag.paymentId, donationId])
                .catch(() => {});
        }

        let resultado = { mudou: false };
        if (pag.status !== 'PENDENTE') resultado = await DonationModel.aplicarStatus(donationId, pag.status);

        if (eventId) {
            await pool
                .query(`INSERT IGNORE INTO PAYMENT_WEBHOOK_EVENTS (provider, event_id, payload) VALUES (?, ?, ?)`, [
                    gateway.nomeProvedor(),
                    String(eventId).slice(0, 100),
                    JSON.stringify({ paymentId: pag.paymentId, status: pag.status, donationId })
                ])
                .catch(() => {});
        }

        return resultado;
    }

    /* usado pelo cron */
    static async expirarPendentes() {
        const [rows] = await pool.query(
            `SELECT id, gateway_payment_id FROM DONATIONS
              WHERE status = 'PENDENTE' AND expires_at IS NOT NULL AND expires_at < ? LIMIT 50`,
            [new Date()]
        );

        let n = 0;
        for (const r of rows) {
            try {
                /* antes de expirar, vê se não foi paga e o aviso se perdeu */
                if (r.gateway_payment_id && !gateway.ehMock()) await DonationModel.conferirNoGateway(r.id);

                /* só muda se ainda estiver PENDENTE */
                const x = await DonationModel.aplicarStatus(r.id, 'EXPIRADO');
                if (x.mudou) n++;
            } catch (e) {
                console.error(`Erro ao expirar a doação ${r.id}:`, e.message);
            }
        }
        return n;
    }

    /* Top doadores de uma ONG (só doações APROVADAS), para a sessão da ONG. Limite fixo em 5. */
    static async principaisDoadores(ongId) {
        const [rows] = await pool.query(
            `SELECT dp.user_id, dp.nome, dp.sobrenome, dp.apelido_unico, dp.avatar_url,
                    COUNT(*) AS total_doacoes, SUM(d.amount) AS total_valor
             FROM DONATIONS d
             JOIN DOADORES_PROFILES dp ON dp.user_id = d.donor_id
             WHERE d.ong_id = ? AND d.status = 'APROVADO'
             GROUP BY d.donor_id
             ORDER BY total_valor DESC
             LIMIT 5`,
            [ongId]
        );
        return rows.map((r) => ({
            user_id: r.user_id,
            nome: [r.nome, r.sobrenome].filter(Boolean).join(' ') || 'Doador(a)',
            apelido_unico: r.apelido_unico,
            avatar_url: r.avatar_url,
            total_doacoes: Number(r.total_doacoes),
            total_valor: Number(r.total_valor)
        }));
    }

    /* usado só pelo provedor mock, para testar sem gateway */
    static async simularPagamento(donorId, id) {
        const [rows] = await pool.query(`SELECT id FROM DONATIONS WHERE id = ? AND donor_id = ?`, [id, donorId]);
        if (!rows.length) throw new DonationError(404, 'Comprovante não encontrado.');
        await DonationModel.aplicarStatus(id, 'APROVADO');
        return DonationModel.buscar(donorId, id);
    }
}

export default DonationModel;
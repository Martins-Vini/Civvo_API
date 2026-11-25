/* Camada única de pagamento. O resto do back só conhece estas 3 funções:

     criarCobranca({ id, valor, metodo, cpf, email, nome, descricao, expiraEm })
        -> { paymentId, pix: { copia_e_cola, qr_code_base64, expires_at } | null, checkoutUrl | null }
     consultarPagamento(paymentId)
        -> { status: 'PENDENTE'|'APROVADO'|'REJEITADO'|'EXPIRADO'|'ESTORNADO', paymentId, externalReference, valor } | null
     interpretarWebhook(req)
        -> { eventId, paymentId } | null      (lança erro com .status = 401 se a assinatura for inválida)

   Provedor escolhido por PAYMENT_PROVIDER no .env:  "mock" (padrão)  |  "mercadopago"
   Para trocar de gateway (Asaas, Pagar.me...) basta criar outro objeto com essas 3 funções. */

import crypto from 'crypto';
import * as mock from './mockSandboxService.js';

const MP_BASE = 'https://api.mercadopago.com';

const provedor = () => String(process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();

export const nomeProvedor = () => (provedor() === 'mercadopago' ? 'mercadopago' : 'mock');

/* ============================ Mercado Pago ============================ */

async function mpFetch(metodo, caminho, corpo, cabecalhos = {}) {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN não configurado.');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);

    try {
        const resp = await fetch(MP_BASE + caminho, {
            method: metodo,
            signal: ctrl.signal,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...cabecalhos
            },
            body: corpo ? JSON.stringify(corpo) : undefined
        });

        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            const err = new Error(`Mercado Pago respondeu ${resp.status}: ${txt.slice(0, 400)}`);
            err.status = resp.status;
            throw err;
        }
        return await resp.json();
    } finally {
        clearTimeout(timer);
    }
}

/* o MP quer a data com fuso: 2026-11-25T10:00:00.000-03:00 */
function dataComFusoBR(d) {
    return new Date(d.getTime() - 3 * 3600 * 1000).toISOString().replace('Z', '-03:00');
}

const apiPublica = () => String(process.env.API_PUBLIC_URL || '').replace(/\/+$/, '');

function notificationUrl() {
    const base = apiPublica();
    return base ? `${base}/api/donations/webhook` : undefined; /* sem URL pública o MP não consegue avisar */
}

async function mpCriarCobranca({ id, valor, metodo, cpf, email, nome, descricao, expiraEm }) {
    if (metodo === 'PIX') {
        const [primeiro, ...resto] = String(nome || 'Doador').trim().split(/\s+/);
        const p = await mpFetch(
            'POST',
            '/v1/payments',
            {
                transaction_amount: valor,
                description: descricao,
                payment_method_id: 'pix',
                external_reference: String(id),
                notification_url: notificationUrl(),
                date_of_expiration: dataComFusoBR(expiraEm),
                payer: {
                    email,
                    first_name: primeiro,
                    last_name: resto.join(' ') || primeiro,
                    identification: { type: 'CPF', number: cpf }
                }
            },
            { 'X-Idempotency-Key': `civvo-doacao-${id}` }
        );

        const dados = p.point_of_interaction?.transaction_data || {};
        if (!dados.qr_code) throw new Error('Mercado Pago não devolveu o código Pix.');

        return {
            paymentId: String(p.id),
            pix: {
                copia_e_cola: dados.qr_code,
                qr_code_base64: dados.qr_code_base64 || '',
                expires_at: p.date_of_expiration || expiraEm
            },
            checkoutUrl: null
        };
    }

    /* cartão: Checkout Pro (página do MP; os dados do cartão nunca passam pelo Civvo) */
    const retorno = `${apiPublica()}/api/donations/retorno/${id}`;
    const pref = await mpFetch('POST', '/checkout/preferences', {
        items: [{ id: String(id), title: descricao, quantity: 1, unit_price: valor, currency_id: 'BRL' }],
        external_reference: String(id),
        notification_url: notificationUrl(),
        payer: { email },
        back_urls: { success: retorno, failure: retorno, pending: retorno },
        auto_return: 'approved',
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }] },
        expires: true,
        expiration_date_to: dataComFusoBR(expiraEm)
    });

    const url = pref.init_point;
    if (!url) throw new Error('Mercado Pago não devolveu o link de pagamento.');

    return { paymentId: `pref_${pref.id}`, pix: null, checkoutUrl: url };
}

function mpTraduzStatus(p) {
    switch (p.status) {
        case 'approved':
            return 'APROVADO';
        case 'refunded':
        case 'charged_back':
            return 'ESTORNADO';
        case 'cancelled':
            return p.status_detail === 'expired' ? 'EXPIRADO' : 'REJEITADO';
        case 'rejected':
            return 'REJEITADO';
        default: /* pending, in_process, authorized, in_mediation */
            return 'PENDENTE';
    }
}

async function mpConsultarPagamento(paymentId) {
    try {
        const p = await mpFetch('GET', `/v1/payments/${encodeURIComponent(paymentId)}`);
        return {
            status: mpTraduzStatus(p),
            paymentId: String(p.id),
            externalReference: p.external_reference || null,
            valor: Number(p.transaction_amount)
        };
    } catch (e) {
        if (e.status === 404) return null; /* ex.: notificação de teste com id inexistente */
        throw e;
    }
}

function mpInterpretarWebhook(req) {
    const body = req.body || {};
    const q = req.query || {};

    const tipo = body.type || q.type || q.topic;
    if (tipo !== 'payment') return null;

    const paymentId = String(body.data?.id || q['data.id'] || q.id || '');
    if (!paymentId) return null;

    const segredo = process.env.MP_WEBHOOK_SECRET;
    if (segredo) {
        const assinatura = String(req.headers['x-signature'] || '');
        const ts = (assinatura.match(/ts=([^,]+)/) || [])[1];
        const v1 = (assinatura.match(/v1=([^,]+)/) || [])[1];
        const idUrl = String(q['data.id'] || body.data?.id || '').toLowerCase();
        const manifesto = `id:${idUrl};request-id:${req.headers['x-request-id'] || ''};ts:${ts};`;
        const esperado = crypto.createHmac('sha256', segredo).update(manifesto).digest('hex');

        const ok =
            ts &&
            v1 &&
            v1.length === esperado.length &&
            crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(esperado));

        if (!ok) {
            const err = new Error('Assinatura do webhook inválida.');
            err.status = 401;
            throw err;
        }
    }

    return { eventId: `${paymentId}:${req.headers['x-request-id'] || Date.now()}`, paymentId };
}

/* ============================ seleção do provedor ============================ */

const impl = () =>
    provedor() === 'mercadopago'
        ? { criarCobranca: mpCriarCobranca, consultarPagamento: mpConsultarPagamento, interpretarWebhook: mpInterpretarWebhook }
        : mock;

export const criarCobranca = (dados) => impl().criarCobranca(dados);
export const consultarPagamento = (id) => impl().consultarPagamento(id);
export const interpretarWebhook = (req) => impl().interpretarWebhook(req);

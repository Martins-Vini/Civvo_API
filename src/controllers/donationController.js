import DonationModel, { DonationError } from '../models/donationModel.js';
import * as gateway from '../services/paymentGatewayService.js';

const idDoUsuario = (req) => req.user?.userId || req.user?.id;
const idValido = (v) => /^\d+$/.test(String(v || ''));

function responderErro(res, error, mensagemPadrao) {
    if (error instanceof DonationError) return res.status(error.status).json({ error: error.message });
    console.error(mensagemPadrao, error);
    return res.status(500).json({ error: mensagemPadrao });
}

export default class DonationController {
    /* POST /api/donations  ->  { donation, pix?, checkout_url? } */
    static async realizarDoacao(req, res) {
        try {
            const resultado = await DonationModel.criar(idDoUsuario(req), req.body || {});
            return res.status(201).json(resultado);
        } catch (error) {
            return responderErro(res, error, 'Erro ao realizar doação.');
        }
    }

    /* GET /api/donations/minhas  ->  { donations: [...] } */
    static async minhasDoacoes(req, res) {
        try {
            const donations = await DonationModel.minhas(idDoUsuario(req));
            return res.status(200).json({ donations });
        } catch (error) {
            return responderErro(res, error, 'Erro ao carregar o histórico de doações.');
        }
    }

    /* GET /api/donations/:id  (só o dono da doação) */
    static async buscarDoacao(req, res) {
        try {
            if (!idValido(req.params.id)) return res.status(404).json({ error: 'Comprovante não encontrado.' });
            const doacao = await DonationModel.buscar(idDoUsuario(req), Number(req.params.id));
            return res.status(200).json(doacao);
        } catch (error) {
            return responderErro(res, error, 'Erro ao carregar o comprovante.');
        }
    }

    /* POST /api/donations/webhook  (público: quem chama é o gateway) */
    static async webhook(req, res) {
        try {
            const info = gateway.interpretarWebhook(req);
            if (!info) return res.status(200).json({ ok: true, ignorado: true });

            await DonationModel.sincronizarComGateway(info);
            return res.status(200).json({ ok: true });
        } catch (error) {
            if (error.status === 401) return res.status(401).json({ error: 'Assinatura inválida.' });
            console.error('Erro no webhook de pagamento:', error);
            /* 500 faz o gateway tentar de novo mais tarde */
            return res.status(500).json({ error: 'Erro ao processar o aviso de pagamento.' });
        }
    }

    /* GET /api/donations/retorno/:id  (público: o gateway devolve o doador do cartão para cá,
       e daqui ele segue para o comprovante no front) */
    static retorno(req, res) {
        const front = String(process.env.FRONT_URL || 'http://localhost:5173').replace(/\/+$/, '');
        if (!idValido(req.params.id)) return res.redirect(302, front);
        return res.redirect(302, `${front}/#/recibo/${req.params.id}`);
    }

    /* POST /api/donations/:id/simular-pagamento  (só com PAYMENT_PROVIDER=mock e fora de produção) */
    static async simularPagamento(req, res) {
        if (gateway.nomeProvedor() !== 'mock' || process.env.NODE_ENV === 'production') {
            return res.status(404).json({ error: 'Rota não encontrada.' });
        }
        try {
            if (!idValido(req.params.id)) return res.status(404).json({ error: 'Comprovante não encontrado.' });
            const doacao = await DonationModel.simularPagamento(idDoUsuario(req), Number(req.params.id));
            return res.status(200).json(doacao);
        } catch (error) {
            return responderErro(res, error, 'Erro ao simular o pagamento.');
        }
    }
}

import DonationModel from '../models/donationModel.js';

/* tarefas periódicas (sem dependência extra: setInterval) */
export function iniciarCron() {
    if (process.env.NODE_ENV === 'test') return;

    /* a cada minuto: doações PENDENTES com prazo vencido viram EXPIRADO */
    const expirar = async () => {
        try {
            const n = await DonationModel.expirarPendentes();
            if (n) console.log(`⏱️  ${n} doação(ões) pendente(s) expirada(s).`);
        } catch (e) {
            console.error('Erro ao expirar doações pendentes:', e.message);
        }
    };

    setInterval(expirar, 60_000).unref();
}

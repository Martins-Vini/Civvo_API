/* Gateway de MENTIRA, só para desenvolver e testar sem conta em gateway real.
   Ativo quando PAYMENT_PROVIDER não é definido (ou é "mock").
   Nenhum dinheiro se move. Para "pagar", chame POST /api/donations/:id/simular-pagamento
   (essa rota só existe fora de produção e com o provedor mock). */

const PNG_1X1 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export async function criarCobranca({ id, metodo, expiraEm }) {
    const paymentId = `mock_${id}_${Date.now()}`;

    if (metodo === 'PIX') {
        return {
            paymentId,
            pix: {
                copia_e_cola: `00020126MOCKCIVVO${id}5204000053039865802BR5905CIVVO6009SAO PAULO6304ABCD`,
                qr_code_base64: PNG_1X1,
                expires_at: expiraEm
            },
            checkoutUrl: null
        };
    }

    return { paymentId, pix: null, checkoutUrl: null };
}

/* o mock não tem webhook nem consulta */
export async function consultarPagamento() {
    return null;
}

export function interpretarWebhook() {
    return null;
}

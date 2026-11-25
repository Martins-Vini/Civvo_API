/* Limitador simples em memória (por usuário logado, ou por IP).
   Serve para 1 instância do servidor; com várias instâncias use um limitador com Redis. */

export function limitarRequisicoes({ janelaMs = 60_000, max = 10, mensagem = 'Muitas tentativas. Aguarde um instante e tente de novo.' } = {}) {
    const acessos = new Map();

    setInterval(() => {
        const agora = Date.now();
        for (const [chave, v] of acessos) if (v.fim < agora) acessos.delete(chave);
    }, janelaMs).unref();

    return (req, res, next) => {
        const chave = String(req.user?.userId || req.ip);
        const agora = Date.now();
        let v = acessos.get(chave);

        if (!v || v.fim < agora) {
            v = { n: 0, fim: agora + janelaMs };
            acessos.set(chave, v);
        }

        v.n += 1;
        if (v.n > max) {
            res.set('Retry-After', String(Math.ceil((v.fim - agora) / 1000)));
            return res.status(429).json({ error: mensagem });
        }
        next();
    };
}

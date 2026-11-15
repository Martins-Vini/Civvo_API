import { pool } from '../config/conexao.js';

export class ErroPerfil extends Error {
    constructor(mensagem, status = 400) {
        super(mensagem);
        this.status = status;
    }
}

export const REDES = ['tiktok', 'instagram', 'x', 'facebook', 'youtube'];

/* ---------- validações ---------- */
const texto = (v, max, rotulo) => {
    if (v === undefined) return undefined;
    const s = String(v ?? '').trim();
    if (s.length > max) throw new ErroPerfil(`${rotulo}: no máximo ${max} caracteres.`);
    return s === '' ? null : s;
};

const obrigatorio = (v, max, rotulo) => {
    if (v === undefined) return undefined;
    const s = texto(v, max, rotulo);
    if (!s) throw new ErroPerfil(`${rotulo} é obrigatório.`);
    return s;
};

const corValida = (v) => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    if (!/^#[0-9a-fA-F]{6}$/.test(String(v))) throw new ErroPerfil('Cor da capa inválida.');
    return String(v).toLowerCase();
};

/* fotos só podem ser removidas por aqui (null); para trocar, use o envio de imagem */
const soNulo = (v, rotulo) => {
    if (v === undefined) return undefined;
    if (v !== null) throw new ErroPerfil(`${rotulo}: para trocar a imagem, envie o arquivo.`);
    return null;
};

const urlHttps = (u) => /^https:\/\/\S+$/i.test(u) && u.length <= 255;

const limparRedes = (redes) => {
    if (redes === undefined) return undefined;
    const r = {};
    for (const k of REDES) {
        const u = String(redes?.[k] ?? '').trim();
        if (u && !urlHttps(u)) throw new ErroPerfil(`Link de ${k} inválido: comece com https://.`);
        r[k] = u;
    }
    return r;
};

const jsonDe = (v, padrao) => {
    if (v == null) return padrao;
    if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return padrao; }
    }
    return v;
};

/* ---------- leitura ---------- */
async function enderecoDe(db, userId) {
    const [r] = await db.query(
        'SELECT rua, bairro, cidade, estado, cep FROM USER_ENDERECOS WHERE user_id = ? AND is_active = TRUE ORDER BY id DESC LIMIT 1',
        [userId]
    );
    return r[0] || null;
}

async function telefoneDe(db, userId) {
    const [r] = await db.query(
        'SELECT ddd, numero, is_whatsapp FROM USER_TELEFONES WHERE user_id = ? AND is_active = TRUE ORDER BY id DESC LIMIT 1',
        [userId]
    );
    return r[0] ? { ddd: r[0].ddd, numero: r[0].numero, whats: !!r[0].is_whatsapp } : null;
}

async function redesDeOng(db, userId) {
    const [r] = await db.query('SELECT plataforma, url FROM USER_SOCIAL_NETWORKS WHERE user_id = ?', [userId]);
    const redes = {};
    for (const x of r) redes[String(x.plataforma).toLowerCase()] = x.url;
    return redes;
}

export const PerfilModel = {
    async tipoDoUsuario(userId) {
        const [r] = await pool.query('SELECT user_type FROM USERS WHERE id = ?', [userId]);
        return r.length ? r[0].user_type : null;
    },

    /* dados completos do próprio usuário (para a tela de edição) */
    async obterMeu(userId) {
        const tipo = await this.tipoDoUsuario(userId);

        if (tipo === 'ONG') {
            const [r] = await pool.query('SELECT * FROM ONGS_PROFILES WHERE user_id = ?', [userId]);
            if (!r.length) return null;
            const o = r[0];
            return {
                tipo: 'ONG',
                ong_id: o.id,
                nome_fantasia: o.nome_fantasia,
                razao_social: o.razao_social,
                cnpj: o.cnpj,
                cnae: o.cnae,
                historia: o.historia,
                causas_atendidas: o.causas_atendidas,
                chave_pix: o.chave_pix,
                logo_url: o.logo_url,
                banner_url: o.banner_url,
                banner_cor: o.banner_cor ?? null,
                missao: o.missao ?? null,
                objetivos: o.objetivos ?? null,
                gestao: o.gestao ?? null,
                governanca: o.governanca ?? null,
                nivel_transparencia: o.nivel_transparencia,
                plano_tipo: o.plano_tipo,
                endereco: await enderecoDe(pool, userId),
                telefone: await telefoneDe(pool, userId),
                redes: await redesDeOng(pool, userId),
            };
        }

        if (tipo === 'DOADOR') {
            const [r] = await pool.query('SELECT * FROM DOADORES_PROFILES WHERE user_id = ?', [userId]);
            if (!r.length) return null;
            const d = r[0];
            return {
                tipo: 'DOADOR',
                nome: d.nome,
                sobrenome: d.sobrenome,
                apelido_unico: d.apelido_unico,
                cpf: d.cpf,
                bio: d.bio,
                avatar_url: d.avatar_url,
                banner_url: d.banner_url ?? null,
                banner_cor: d.banner_cor ?? null,
                causas: jsonDe(d.causas_interesse, []),
                voluntariados_publicos: d.voluntariados_publicos == null ? true : !!d.voluntariados_publicos,
                endereco: await enderecoDe(pool, userId),
                telefone: await telefoneDe(pool, userId),
                redes: jsonDe(d.redes_sociais, {}),
            };
        }

        return null;
    },

    /* perfil público de uma ONG (sem Pix, telefone e endereço completo) */
    async obterOngPublico(ongId) {
        const [r] = await pool.query('SELECT * FROM ONGS_PROFILES WHERE id = ? AND is_active = TRUE', [ongId]);
        if (!r.length) return null;
        const o = r[0];
        const end = await enderecoDe(pool, o.user_id);
        return {
            ong_id: o.id,
            nome_fantasia: o.nome_fantasia,
            razao_social: o.razao_social,
            cnpj: o.cnpj,
            cnae: o.cnae,
            historia: o.historia,
            causas_atendidas: o.causas_atendidas,
            logo_url: o.logo_url,
            banner_url: o.banner_url,
            banner_cor: o.banner_cor ?? null,
            missao: o.missao ?? null,
            objetivos: o.objetivos ?? null,
            gestao: o.gestao ?? null,
            governanca: o.governanca ?? null,
            nivel_transparencia: o.nivel_transparencia,
            cidade: end ? end.cidade : null,
            estado: end ? end.estado : null,
            redes: await redesDeOng(pool, o.user_id),
        };
    },

    /* ---------- escrita ---------- */
    async atualizar(userId, d) {
        const tipo = await this.tipoDoUsuario(userId);
        if (tipo !== 'ONG' && tipo !== 'DOADOR') throw new ErroPerfil('Este tipo de conta não tem perfil editável.', 403);

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            if (tipo === 'ONG') await atualizarOng(conn, userId, d);
            else await atualizarDoador(conn, userId, d);

            if (d.endereco) await salvarEndereco(conn, userId, d.endereco);
            if (d.telefone) await salvarTelefone(conn, userId, d.telefone);

            await conn.commit();
        } catch (e) {
            await conn.rollback();
            if (e.code === 'ER_DUP_ENTRY') throw new ErroPerfil('Este apelido já está em uso. Escolha outro.', 409);
            throw e;
        } finally {
            conn.release();
        }
        return this.obterMeu(userId);
    },

    /* grava a URL de uma imagem já enviada (foto de perfil ou capa) */
    async salvarImagem(userId, alvo, url) {
        const tipo = await this.tipoDoUsuario(userId);
        const colunas = {
            ONG: { tabela: 'ONGS_PROFILES', avatar: 'logo_url', banner: 'banner_url' },
            DOADOR: { tabela: 'DOADORES_PROFILES', avatar: 'avatar_url', banner: 'banner_url' },
        }[tipo];
        if (!colunas) throw new ErroPerfil('Este tipo de conta não tem perfil editável.', 403);

        const coluna = colunas[alvo];
        if (!coluna) throw new ErroPerfil('Tipo de imagem inválido.');
        await pool.query(`UPDATE ${colunas.tabela} SET ${coluna} = ? WHERE user_id = ?`, [url, userId]);
        return url;
    },
};

/* monta o UPDATE só com o que veio na requisição */
async function aplicarUpdate(conn, tabela, userId, campos) {
    const chaves = Object.keys(campos).filter((k) => campos[k] !== undefined);
    if (!chaves.length) return;
    const sets = chaves.map((k) => `${k} = ?`).join(', ');
    await conn.query(`UPDATE ${tabela} SET ${sets} WHERE user_id = ?`, [...chaves.map((k) => campos[k]), userId]);
}

async function atualizarOng(conn, userId, d) {
    await aplicarUpdate(conn, 'ONGS_PROFILES', userId, {
        nome_fantasia: obrigatorio(d.nome_fantasia, 255, 'Nome da ONG'),
        cnae: texto(d.cnae, 20, 'CNAE'),
        historia: texto(d.historia, 5000, 'Nossa história'),
        causas_atendidas: texto(d.causas_atendidas, 1000, 'Causas atendidas'),
        chave_pix: texto(d.chave_pix, 255, 'Chave Pix'),
        missao: texto(d.missao, 2000, 'Missão'),
        objetivos: texto(d.objetivos, 2000, 'Objetivos'),
        gestao: texto(d.gestao, 255, 'Gestão'),
        governanca: texto(d.governanca, 500, 'Pessoas governadoras'),
        banner_cor: corValida(d.banner_cor),
        banner_url: soNulo(d.banner_url, 'Capa'),
        logo_url: soNulo(d.logo_url, 'Foto de perfil'),
    });

    const redes = limparRedes(d.redes);
    if (redes) {
        await conn.query(`DELETE FROM USER_SOCIAL_NETWORKS WHERE user_id = ? AND plataforma IN (?)`, [userId, REDES]);
        for (const k of REDES) {
            if (redes[k]) {
                await conn.query('INSERT INTO USER_SOCIAL_NETWORKS (user_id, plataforma, url) VALUES (?, ?, ?)', [userId, k, redes[k]]);
            }
        }
    }
}

async function atualizarDoador(conn, userId, d) {
    let cpf = d.cpf;
    if (cpf !== undefined) {
        cpf = String(cpf ?? '').replace(/\D/g, '');
        if (cpf && cpf.length !== 11) throw new ErroPerfil('O CPF deve ter 11 dígitos.');
        cpf = cpf || null;
    }

    let apelido = obrigatorio(d.apelido_unico, 50, 'Apelido');
    if (apelido !== undefined && !/^[A-Za-z0-9._]{3,30}$/.test(apelido)) {
        throw new ErroPerfil('O apelido deve ter de 3 a 30 caracteres: letras, números, ponto ou sublinhado.');
    }

    let causas;
    if (d.causas !== undefined) {
        if (!Array.isArray(d.causas) || d.causas.length > 20) throw new ErroPerfil('Causas de interesse inválidas.');
        causas = JSON.stringify(d.causas.map((c) => String(c).trim().slice(0, 60)).filter(Boolean));
    }

    const redes = limparRedes(d.redes);

    await aplicarUpdate(conn, 'DOADORES_PROFILES', userId, {
        nome: obrigatorio(d.nome, 100, 'Nome'),
        sobrenome: obrigatorio(d.sobrenome, 100, 'Sobrenome'),
        apelido_unico: apelido,
        cpf,
        bio: texto(d.bio, 1000, 'Bio'),
        banner_cor: corValida(d.banner_cor),
        banner_url: soNulo(d.banner_url, 'Capa'),
        avatar_url: soNulo(d.avatar_url, 'Foto de perfil'),
        causas_interesse: causas,
        voluntariados_publicos: d.voluntariados_publicos === undefined ? undefined : !!d.voluntariados_publicos,
        redes_sociais: redes === undefined ? undefined : JSON.stringify(redes),
    });
}

async function salvarEndereco(conn, userId, e) {
    const rua = String(e.rua ?? '').trim();
    const bairro = String(e.bairro ?? '').trim();
    const cidade = String(e.cidade ?? '').trim();
    const estado = String(e.estado ?? '').trim().toUpperCase();
    const cep = String(e.cep ?? '').replace(/\D/g, '');

    if (!rua && !bairro && !cidade && !estado && !cep) return; // nada preenchido: mantém como está
    if (!rua || !bairro || !cidade) throw new ErroPerfil('Endereço: preencha rua, bairro e cidade.');
    if (!/^[A-Z]{2}$/.test(estado)) throw new ErroPerfil('Endereço: o estado deve ter 2 letras (UF).');
    if (cep.length !== 8) throw new ErroPerfil('Endereço: o CEP deve ter 8 dígitos.');
    if (rua.length > 255 || bairro.length > 100 || cidade.length > 100) throw new ErroPerfil('Endereço: algum campo está longo demais.');

    const [ex] = await conn.query('SELECT id FROM USER_ENDERECOS WHERE user_id = ? AND is_active = TRUE ORDER BY id DESC LIMIT 1', [userId]);
    if (ex.length) {
        await conn.query(
            'UPDATE USER_ENDERECOS SET rua = ?, bairro = ?, cidade = ?, estado = ?, cep = ? WHERE id = ?',
            [rua, bairro, cidade, estado, cep, ex[0].id]
        );
    } else {
        await conn.query(
            'INSERT INTO USER_ENDERECOS (user_id, rua, bairro, cidade, estado, cep) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, rua, bairro, cidade, estado, cep]
        );
    }
}

async function salvarTelefone(conn, userId, t) {
    const ddd = String(t.ddd ?? '').replace(/\D/g, '');
    const numero = String(t.numero ?? '').replace(/\D/g, '');
    const whats = !!t.whats;

    if (!ddd && !numero) return; // nada preenchido: mantém como está
    if (ddd.length !== 2) throw new ErroPerfil('Telefone: o DDD deve ter 2 dígitos.');
    if (numero.length < 8 || numero.length > 9) throw new ErroPerfil('Telefone: o número deve ter 8 ou 9 dígitos.');

    const [ex] = await conn.query('SELECT id FROM USER_TELEFONES WHERE user_id = ? AND is_active = TRUE ORDER BY id DESC LIMIT 1', [userId]);
    if (ex.length) {
        await conn.query('UPDATE USER_TELEFONES SET ddd = ?, numero = ?, is_whatsapp = ? WHERE id = ?', [ddd, numero, whats, ex[0].id]);
    } else {
        await conn.query('INSERT INTO USER_TELEFONES (user_id, ddd, numero, is_whatsapp) VALUES (?, ?, ?, ?)', [userId, ddd, numero, whats]);
    }
}
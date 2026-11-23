import { pool } from '../config/conexao.js';
import { SQL_ONG_VERIFICADA } from '../utils/verificationSql.js';

export const SearchModel = {
    /* tipo: 'ONG' | 'DOADOR' | null (ambos) */
    async buscar(query, tipo) {
        const termo = `%${String(query || '').trim()}%`;
        const resultados = [];

        if (tipo !== 'DOADOR') {
            const [ongs] = await pool.query(
                `SELECT o.id AS ong_id, o.user_id, o.nome_fantasia, o.causas_atendidas, o.logo_url,
                        e.cidade,
                        (SELECT COUNT(*) FROM USER_FOLLOWERS f WHERE f.following_id = o.user_id) AS seguidores,
                        ${SQL_ONG_VERIFICADA} AS is_verified
                 FROM ONGS_PROFILES o
                 LEFT JOIN USER_ENDERECOS e ON e.user_id = o.user_id AND e.is_active = TRUE
                 WHERE o.is_active = TRUE
                   AND (o.nome_fantasia LIKE ? OR o.causas_atendidas LIKE ? OR e.cidade LIKE ?)
                 ORDER BY o.nome_fantasia
                 LIMIT 40`,
                [termo, termo, termo]
            );
            for (const o of ongs) {
                resultados.push({
                    tipo: 'ONG',
                    ong_id: o.ong_id,
                    user_id: o.user_id,
                    nome: o.nome_fantasia,
                    subtitulo: o.causas_atendidas || '',
                    cidade: o.cidade || '',
                    avatar: o.logo_url,
                    seguidores: Number(o.seguidores) || 0,
                    is_verified: !!o.is_verified,
                });
            }
        }

        if (tipo !== 'ONG') {
            const [doadores] = await pool.query(
                `SELECT d.user_id, d.nome, d.sobrenome, d.apelido_unico, d.avatar_url,
                        e.cidade
                 FROM DOADORES_PROFILES d
                 LEFT JOIN USER_ENDERECOS e ON e.user_id = d.user_id AND e.is_active = TRUE
                 WHERE d.is_active = TRUE
                   AND (d.nome LIKE ? OR d.sobrenome LIKE ? OR d.apelido_unico LIKE ? OR e.cidade LIKE ?)
                 ORDER BY d.nome
                 LIMIT 40`,
                [termo, termo, termo, termo]
            );
            for (const d of doadores) {
                resultados.push({
                    tipo: 'DOADOR',
                    user_id: d.user_id,
                    nome: `${d.nome} ${d.sobrenome}`.trim(),
                    subtitulo: `@${d.apelido_unico}`,
                    cidade: d.cidade || '',
                    avatar: d.avatar_url,
                });
            }
        }

        return resultados;
    },
};

/* Fragmento SQL reutilizável (sem coluna no banco): verdadeiro quando a ONG já
   preencheu as 13 pendências do perfil (mesma lista do front em pendenciasOng()).
   Espera que a tabela ONGS_PROFILES esteja no FROM/JOIN com alias "o". */
export const SQL_ONG_VERIFICADA = `(
    o.logo_url IS NOT NULL AND o.logo_url <> '' AND
    ((o.banner_url IS NOT NULL AND o.banner_url <> '') OR (o.banner_cor IS NOT NULL AND o.banner_cor <> '')) AND
    o.historia IS NOT NULL AND o.historia <> '' AND
    o.causas_atendidas IS NOT NULL AND o.causas_atendidas <> '' AND
    o.cnae IS NOT NULL AND o.cnae <> '' AND
    o.chave_pix IS NOT NULL AND o.chave_pix <> '' AND
    o.missao IS NOT NULL AND o.missao <> '' AND
    o.objetivos IS NOT NULL AND o.objetivos <> '' AND
    o.gestao IS NOT NULL AND o.gestao <> '' AND
    o.governanca IS NOT NULL AND o.governanca <> '' AND
    EXISTS (SELECT 1 FROM USER_ENDERECOS ue WHERE ue.user_id = o.user_id AND ue.is_active = TRUE) AND
    EXISTS (SELECT 1 FROM USER_TELEFONES ut WHERE ut.user_id = o.user_id AND ut.is_active = TRUE) AND
    EXISTS (SELECT 1 FROM USER_SOCIAL_NETWORKS usn WHERE usn.user_id = o.user_id)
)`;

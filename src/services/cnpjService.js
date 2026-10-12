// 1. Validação matemática dos dígitos verificadores
export function validarAlgoritmoCnpj(cnpj) {
    cnpj = cnpj.replace(/[^\d]+/g, '');
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;

    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    return resultado === parseInt(digitos.charAt(1));
}

// 2. Consulta oficial com extração correta para o padrão do Banco de Dados
export async function consultarCnpj(cnpjLimpo) {
    cnpjLimpo = cnpjLimpo.replace(/[^\d]+/g, '');

    if (!validarAlgoritmoCnpj(cnpjLimpo)) {
        throw new Error("CNPJ matematicamente inválido. Verifique os dígitos.");
    }

    let data = null;

    // Provedor 1: BrasilAPI
    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
        if (response.ok) {
            data = await response.json();
        }
    } catch (err) {
        console.warn("⚠️ BrasilAPI falhou, tentando alternativa...");
    }

    // Provedor 2: Minha Receita (Fallback)
    if (!data) {
        try {
            const response = await fetch(`https://minhareceita.org/${cnpjLimpo}`);
            if (response.ok) {
                const resJson = await response.json();
                data = {
                    razao_social: resJson.razao_social,
                    nome_fantasia: resJson.nome_fantasia || resJson.razao_social,
                    cnae_fiscal: resJson.cnae_fiscal,
                    atividade_principal: resJson.atividade_principal,
                    descricao_situacao_cadastral: resJson.descricao_situacao_cadastral || resJson.situacao,
                    logradouro: resJson.logradouro,
                    bairro: resJson.bairro,
                    municipio: resJson.municipio || resJson.cidade,
                    uf: resJson.uf,
                    cep: resJson.cep
                };
            }
        } catch (err) {
            console.warn("⚠️ Minha Receita falhou...");
        }
    }

    if (!data) {
        throw new Error("Não foi possível validar este CNPJ na Receita Federal no momento.");
    }

    // Valida se está ATIVA
    const situacao = String(data.descricao_situacao_cadastral || data.situacao || '').toUpperCase();
    if (situacao && situacao !== 'ATIVA' && situacao !== '2') {
        throw new Error(`Cadastro recusado: A situação deste CNPJ é '${situacao}'. Apenas ONGs ATIVAS são permitidas.`);
    }

    // Extrai o código do CNAE de forma limpa para caber no VARCHAR(20) do banco
    let cnaeFormatado = '9499-5/00'; // Padrão de fallback caso venha vazio
    if (data.cnae_fiscal) {
        const strCnae = String(data.cnae_fiscal).replace(/\D/g, '');
        if (strCnae.length === 7) {
            cnaeFormatado = `${strCnae.slice(0, 4)}-${strCnae.slice(4, 5)}/${strCnae.slice(5)}`;
        } else {
            cnaeFormatado = strCnae;
        }
    } else if (data.atividade_principal?.[0]?.code) {
        cnaeFormatado = data.atividade_principal[0].code;
    }

    return {
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia || data.razao_social,
        cnae: cnaeFormatado,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.municipio || '',
        estado: data.uf || '',
        cep: (data.cep || '').replace(/\D/g, '')
    };
}
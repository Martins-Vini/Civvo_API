import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OngModel } from '../models/ongModel.js';
import { consultarCnpj } from '../services/cnpjService.js';

export class OngAuthController {
    static async cadastrarOng(req, res) {
        try {
            const { email, password, cnpj, logo_url, banner_url, historia, causas_atendidas, chave_pix, nivel_transparencia, telefone, endereco_customizado } = req.body;

            const cnpjLimpo = cnpj.replace(/\D/g, '');

            const ongExistente = await OngModel.buscarPorCnpj(cnpjLimpo);
            if (ongExistente) {
                return res.status(400).json({ error: "Este CNPJ já está cadastrado no sistema." });
            }

            // Valida e preenche automaticamente os dados via API da Receita Federal
            let dadosReceita;
            try {
                dadosReceita = await consultarCnpj(cnpjLimpo);
            } catch (err) {
                console.error("Erro capturado no cadastro de ONG:", err.message); // Imprime o erro real no terminal
                return res.status(400).json({ error: err.message });
            }

            const emailExistente = await OngModel.buscarPorEmail(email);
            if (emailExistente) {
                return res.status(400).json({ error: "Este email já está em uso." });
            }

            const password_hash = await bcrypt.hash(password, 10);

            // Dados oficiais injetados automaticamente e imutáveis por manipulação externa direta
            const ongData = {
                cnpj: cnpjLimpo,
                razao_social: dadosReceita.razao_social,
                nome_fantasia: dadosReceita.nome_fantasia,
                cnae: dadosReceita.cnae,
                logo_url,
                banner_url,
                historia,
                causas_atendidas,
                chave_pix,
                nivel_transparencia
            };

            // Endereço obtido da Receita Federal (com flexibilidade opcional para ajustes de entrega/correspondência)
            const enderecoData = {
                rua: endereco_customizado?.rua || dadosReceita.logradouro,
                bairro: endereco_customizado?.bairro || dadosReceita.bairro,
                cidade: endereco_customizado?.cidade || dadosReceita.cidade,
                estado: endereco_customizado?.estado || dadosReceita.estado,
                cep: endereco_customizado?.cep || dadosReceita.cep.replace(/\D/g, '')
            };

            const telefoneData = {
                ddd: telefone.ddd,
                numero: telefone.numero,
                is_whatsapp: telefone.is_whatsapp
            };

            const userId = await OngModel.criar(
                { email, password_hash },
                ongData,
                enderecoData,
                telefoneData
            );

            return res.status(201).json({ 
                message: "ONG cadastrada com sucesso e validada pela Receita Federal!", 
                userId,
                dadosOficiais: {
                    razao_social: dadosReceita.razao_social,
                    nome_fantasia: dadosReceita.nome_fantasia
                }
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro interno ao cadastrar a ONG." });
        }
    }

    static async entrarOng(req, res) {
        try {
            const { email, password } = req.body;

            const ong = await OngModel.buscarPorEmail(email);
            if (!ong) {
                return res.status(401).json({ error: "Credenciais inválidas." });
            }

            const senhaValida = await bcrypt.compare(password, ong.password_hash);
            if (!senhaValida) {
                return res.status(401).json({ error: "Credenciais inválidas." });
            }

            const secret = process.env.JWT_SECRET || 'chave_secreta_temporaria';
            const token = jwt.sign(
                { 
                    userId: ong.id, 
                    ongProfileId: ong.ong_profile_id,
                    userType: ong.user_type,
                    cnpj: ong.cnpj 
                }, 
                secret, 
                { expiresIn: '7d' }
            );

            return res.status(200).json({
                message: "Login da ONG realizado com sucesso!",
                token,
                ong: {
                    id: ong.id,
                    ongProfileId: ong.ong_profile_id,
                    razaoSocial: ong.razao_social,
                    nomeFantasia: ong.nome_fantasia,
                    cnpj: ong.cnpj
                }
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao realizar login da ONG." });
        }
    }
}
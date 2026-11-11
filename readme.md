# 🌐 Civvo API — Plataforma Social de Conectividade de ONGs e Doadores

A **Civvo API** é o núcleo backend robusto da plataforma **Civvo** (projeto derivado da iniciativa **Omoyari**), desenvolvida para conectar organizações não governamentais (ONGs), doadores e voluntários, com foco inicial em ONGs da Cidade Tiradentes e Zona Leste de São Paulo. 

A aplicação gerencia a autenticação descentralizada (com suporte a Doadores, ONGs e Administradores), publicação de posts/demandas sociais, sistemas de denúncia e moderação administrativa, além de fluxos de integração para verificação por e-mail e autenticação social via Google OAuth 2.0.

---

## 🛠️ Tecnologias e Stack do Backend

- **Runtime Environment:** [Node.js](https://nodejs.org/) (ES Modules)
- **Framework Web:** [Express.js](https://expressjs.com/)
- **Banco de Dados Relacional:** [MySQL](https://www.mysql.com/) (gerenciado via biblioteca de alto desempenho `mysql2/promise` com Connection Pool)
- **Autenticação & Segurança:** 
  - `jsonwebtoken` (JWT): Geração e validação de tokens de acesso por perfil (Doador, ONG, Admin)
  - `bcrypt`: Criptografia unidirecional com *salt* para hashes de senhas
  - `google-auth-library`: Validação de tokens OAuth 2.0 / SSO do Google no servidor
- **Gerenciamento de Arquivos:** `multer` para upload seguro de mídias/imagens de campanhas e perfis
- **Serviços de E-mail:** Integração com APIs transacionais (`Brevo` / `Resend`) para verificação de conta e recuperação de credenciais

---

## 📐 Arquitetura do Sistema e Padrão MVC

A API segue uma arquitetura orientada ao padrão **MVC (Model-View-Controller)** adaptada para RESTful APIs, priorizando o desacoplamento de responsabilidades e facilitando a manutenção do código.

              +-----------------------+
              |    Requisição HTTP    |
              +-----------+-----------+
                          |
                          v
              +-----------------------+
              |    Routes / Router    |
              +-----------+-----------+
                          |
                          v
              +-----------------------+
              |      Middlewares      |
              | (Auth / Validation)   |
              +-----------+-----------+
                          |
                          v
              +-----------------------+
              |      Controller       | <--- Lógica de Negócio, HTTP Codes (200, 400, 500)
              +-----+-----------+-----+
                    |           |
         (Queries)  |           | (JSON Responses)
                    v           v
              +-----------+ +-----------+
              |   Model   | |   Client  |
              +-----+-----+ +-----------+
                    |
         (SQL)      v
              +-----------+
              | MySQL DB  |
              +-----------+

### Divisão de Responsabilidades no MVC:
1. **Model (Camada de Dados):** Contém a lógica de acesso ao banco de dados (`pool.query`). O Model não conhece requisições HTTP (`req`) nem respostas (`res`); apenas executa as queries SQL (INSERT, SELECT, UPDATE, DELETE) e manipula as regras de transação (`beginTransaction`, `commit`, `rollback`).
2. **View (Camada de Apresentação):** Em uma arquitetura de API desacoplada, a "View" é representada pelas respostas formatadas em JSON retornado aos clientes (Web / Mobile).
3. **Controller (Camada de Controle):** Recebe o `req.body` ou `req.params`, executa validações de regras de negócio, aciona os métodos dos Models e devolve o status HTTP apropriado com os dados formatados.

---

## 📂 Estrutura de Pastas e Arquivos do Projeto

Conforme a árvore de diretórios configurada na aplicação:

Civvo_API/
├── src/
│   ├── config/          # Configuração de conexões (MySQL pool, variáveis globais)
│   ├── controllers/     # Camada de controle da lógica de negócio e retornos HTTP
│   ├── middlewares/     # Interceptadores de requisições (JWT auth, papéis, upload, rate limit)
│   ├── models/          # Camada de acesso ao banco de dados (queries SQL e transações)
│   ├── routes/          # Definição das rotas e endpoints da API
│   ├── services/        # Integrações externas (Envio de e-mails via Brevo/Resend, OAuth)
│   └── utils/           # Funções auxiliares, formatadores, máscaras e validadores
├── tests/               # Suítes de testes unitários e de integração
├── .env                 # Variáveis de ambiente da aplicação (Segredos, credenciais DB)
├── .env.example         # Template com o exemplo de variáveis necessárias para execução
├── .gitignore           # Arquivos ignorados pelo controle de versão Git
├── gerarAdmin.js        # Script utilitário CLI para geração inicial de usuários Administradores
├── index.js             # Ponto de entrada (Entry point) da aplicação Express
├── package.json         # Dependências do Node.js, scripts executáveis e configurações
└── readme.md            # Documentação técnica do projeto

## Detalhamento das Pastas de Código (src/)
src/config/: Centraliza os parâmetros de conexão. Contém o arquivo de inicialização do Pool do MySQL (conexao.js), abstraindo detalhes de credenciais.

src/controllers/: Contém os controladores segregados por domínio da aplicação (userController.js, adminController.js, postController.js, ongController.js, donorController.js, campaignController.js, etc.).

src/middlewares/: Contém as travas de segurança e filtros de requisição:

authMiddleware.js: Validação de tokens JWT de usuários gerais.

authAdminMiddleware.js / roleMiddleware.js: Restrição de rotas para Administradores ou Perfis Específicos.

uploadMiddleware.js: Trata uploads de arquivos via Multer.

rateLimitMiddleware.js / kybCheckMiddleware.js: Proteção contra abusos de requisição e validação de verificação de ONGs.

src/models/: Contém o mapeamento e abstração de tabelas (USERS, ADMIN_PROFILES, ONGS_PROFILES, DOADORES_PROFILES, POSTS, POST_REPORTS, etc.).

src/routes/: Define os caminhos acessíveis (/api/auth, /api/admin, /api/posts, /api/donations, etc.) vinculando cada rota ao seu middleware e controller correspondente.

src/services/: Concentra módulos de terceiros (serviços de e-mail transacional, OAuth Client do Google).

src/utils/: Funções reutilizáveis como geradores de códigos de verificação de 6 dígitos, validações sintáticas de documentos (CPF/CNPJ), etc.

## 🚀 Como Executar o Projeto Localmente
Pré-requisitos:
Node.js versão 18.x ou superior instalado.

Servidor MySQL rodando localmente ou via container Docker/instância remota.

Passos de Instalação:
Clonar o repositório e instalar as dependências:

Bash
git clone [https://github.com/Martins-Vini/Civvo_API.git](https://github.com/Martins-Vini/Civvo_API.git)
cd Civvo_API
npm install


### Configurar as Variáveis de Ambiente:
**Crie um arquivo .env na raiz do projeto com base no arquivo .env.example:**

PORT=8080
DB_HOST=localhost
DB_USER=seu_usuario_mysql
DB_PASSWORD=sua_senha_mysql
DB_NAME=civvo_db
JWT_SECRET=sua_chave_secreta_jwt
GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret
Gerar Administrador Inicial (Opcional):

Bash
node gerarAdmin.js

**Iniciar o Servidor em Ambiente de Desenvolvimento:**

Bash
npm run dev
# Ou caso utilize nodemon diretamente:
npx nodemon index.js
O servidor será inicializado e escutará por padrão na porta http://localhost:8080.

📌 Principais Endpoints Mapeados
POST /api/auth/login — Autenticação de Doadores e ONGs com retorno de Token JWT

POST /api/auth/google — Autenticação/Cadastro unificado via Google SSO

POST /api/admin/login — Autenticação de administradores da plataforma

GET /api/admin/denuncias — Listagem de denúncias ativas em posts (Protegido por JWT Admin)

PUT /api/admin/denuncias/:id — Atualização do status de tratativa da denúncia (PENDENTE, ANALISADO, IGNORADO)

DELETE /api/posts/:id — Remoção de publicação (Permitida para a ONG proprietária ou Administradores)

### 📝 Licença e Autoria
*Desenvolvido por Vinícius Martins de Paiva como parte das iniciativas da plataforma social Civvo / Omoyari. Todos os direitos reservados.*
# 🌐 Civvo API — Plataforma Social de Conectividade para ONGs e Doadores

A **Civvo API** é o núcleo backend robusto da plataforma **Civvo** (iniciativa vinculada ao projeto **Omoyari**), desenvolvida para conectar Organizações Não Governamentais (ONGs), doadores e voluntários, com foco inicial nas instituições da Cidade Tiradentes e Zona Leste de São Paulo.

A aplicação gerencia autenticação descentralizada (suportando **Doadores**, **ONGs** e **Administradores**), publicação de feeds e demandas sociais, moderação administrativa de denúncias, além de integrações completas para verificação de e-mail e autenticação social via **Google OAuth 2.0**.

---

## 🛠️ Tecnologias e Stack do Backend

| Categoria | Tecnologias Utilizadas |
| :--- | :--- |
| **Runtime** | [Node.js](https://nodejs.org/) (ES Modules) |
| **Framework Web** | [Express.js](https://expressjs.com/) |
| **Banco de Dados** | [MySQL](https://www.mysql.com/) (Driver `mysql2/promise` com Connection Pool) |
| **Segurança & Auth** | `jsonwebtoken` (JWT), `bcrypt`, `google-auth-library` |
| **Gerenciamento de Arquivos** | `multer` (Upload seguro de mídias e documentos) |
| **E-mails Transacionais** | APIs de integração com `Brevo` / `Resend` |

---

## 📐 Arquitetura do Sistema e Padrão MVC

A API segue o padrão **MVC (Model-View-Controller)** adaptado para APIs RESTful, garantindo baixo acoplamento e alta legibilidade de código.

```text
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
                  |      Controller       | <--- Lógica de Negócio, HTTP Codes
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
```

### Divisão de Responsabilidades:

1. **Model (Camada de Dados):** Executa consultas SQL diretas (`pool.query`) e gerencia transações completas (`beginTransaction`, `commit`, `rollback`). Não manipula objetos de requisição HTTP (`req`/`res`).
2. **View (Camada de Apresentação):** Representada pelas respostas padronizadas em formato **JSON** devolvidas aos clientes (Web e Mobile).
3. **Controller (Camada de Controle):** Intercepta os dados (`req.body`, `req.params`), aplica as regras de negócio e validações, aciona o Model e constrói a resposta HTTP (`res.status().json()`).

---

## 📂 Estrutura de Pastas do Projeto

```text
Civvo_API/
├── src/
│   ├── config/          # Configurações globais e Pool de conexões MySQL
│   ├── controllers/     # Controladores da lógica de negócio (Doadores, ONGs, Admin, Posts)
│   ├── middlewares/     # Travas de segurança, validação de JWT, roles e uploads
│   ├── models/          # Abstração de queries SQL e manipulação do banco de dados
│   ├── routes/          # Definição e agrupamento dos endpoints da API
│   ├── services/        # Serviços externos (Google OAuth, Envio de e-mails transacionais)
│   └── utils/           # Módulos auxiliares, validadores de CPF/CNPJ e geradores de códigos
├── tests/               # Suítes de testes automatizados (Unitários e Integração)
├── .env                 # Variáveis de ambiente locais (Não comitadas)
├── .env.example         # Modelo de configuração das variáveis necessárias
├── .gitignore           # Lista de exclusão do repositório Git
├── gerarAdmin.js        # Script CLI para cadastro manual do primeiro Administrador
├── index.js             # Ponto de entrada (Entry point) da aplicação Express
├── package.json         # Manifesto de dependências e scripts Node.js
└── README.md            # Documentação oficial do repositório
```

### Detalhamento dos Módulos Principais (`src/`)

* **`src/config/`**: Contém o arquivo `conexao.js` responsável pela gestão de conexões com o MySQL.
* **`src/controllers/`**: Divide os fluxos operacionais por domínio: `userController.js`, `adminController.js`, `postController.js`, `ongController.js`, `donorController.js`, etc.
* **`src/middlewares/`**: 
  * `authMiddleware.js`: Valida o token JWT de usuários gerais.
  * `authAdminMiddleware.js` / `roleMiddleware.js`: Restringe o acesso a rotas administrativas.
  * `uploadMiddleware.js`: Gerencia o upload multipart via Multer.
  * `rateLimitMiddleware.js` / `kybCheckMiddleware.js`: Proteção contra chamadas abusivas e verificação cadastral de ONGs.
* **`src/models/`**: Gerencia a interação direta com as tabelas `USERS`, `ADMIN_PROFILES`, `ONGS_PROFILES`, `DOADORES_PROFILES`, `POSTS` e `POST_REPORTS`.
* **`src/routes/`**: Define as rotas expostas (`/api/auth`, `/api/admin`, `/api/posts`, `/api/donations`).

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
* **Node.js** v18.0.0 ou superior instalado.
* Servidor **MySQL** ativo (Local, Docker ou Cloud).

### Passos para Instalação

1. **Clonar o repositório e instalar as dependências:**
   ```bash
   git clone [https://github.com/Martins-Vini/Civvo_API.git](https://github.com/Martins-Vini/Civvo_API.git)
   cd Civvo_API
   npm install
   ```

2. **Configurar as Variáveis de Ambiente:**
   Crie um arquivo `.env` na raiz do projeto contendo as seguintes definições (com base no `.env.example`):
   ```env
   PORT=8080
   DB_HOST=localhost
   DB_USER=seu_usuario_mysql
   DB_PASSWORD=sua_senha_mysql
   DB_NAME=civvo_db
   JWT_SECRET=sua_chave_secreta_jwt
   GOOGLE_CLIENT_ID=seu_google_client_id
   GOOGLE_CLIENT_SECRET=seu_google_client_secret
   ```

3. **Gerar Administrador Inicial (Opcional):**
   ```bash
   node gerarAdmin.js
   ```

4. **Executar o Servidor em Desenvolvimento:**
   ```bash
   npm run dev
   # Ou via nodemon diretamente:
   npx nodemon index.js
   ```
   *O servidor estará ativo em: `http://localhost:8080`*

---

## 📌 Principais Endpoints

| Método | Endpoint | Descrição | Acesso |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Autenticação padrão de Doadores e ONGs com retorno JWT | Público |
| `POST` | `/api/auth/google` | Autenticação e cadastro integrado via Google SSO | Público |
| `POST` | `/api/admin/login` | Autenticação exclusiva para Administradores | Público |
| `GET` | `/api/admin/denuncias` | Listagem de postagens denunciadas na plataforma | Admin (JWT) |
| `PUT` | `/api/admin/denuncias/:id` | Atualiza o status de tratativa (`PENDENTE`, `ANALISADO`, `IGNORADO`) | Admin (JWT) |
| `DELETE` | `/api/posts/:id` | Exclusão de publicação por violação ou solicitação da ONG | ONG / Admin |

---

### 📝 Licença e Autoria
Desenvolvido por **Vinícius Martins de Paiva** como parte integrante da plataforma **Civvo** / **Omoyari**. Todos os direitos reservados.
>>>>
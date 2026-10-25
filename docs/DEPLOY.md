# Guia de publicação (Cloudflare D1 + Workers / GitHub Pages)

Arquitetura do sistema:

```
   Cloudflare D1 (SQLite)     ←  banco de dados (9 tabelas)
        ▲
        │  Binding D1 (env.DB)
        │
   Cloudflare Worker          ←  API (backend/worker.js) + site estático (opcional)
        ▲
        │  HTTPS / JSON
        │
   Navegador (Worker ou GitHub Pages)
```

---

## Parte 1 — Criar o Banco de Dados Cloudflare D1 e o Worker (pelo Painel Web, sem instalar nada)

### 1.1 Criar o banco D1

1. Acesse o painel da Cloudflare (<https://dash.cloudflare.com>).
2. No menu lateral, vá em **Storage & Databases → D1 SQL Database**.
3. Clique em **Create Database**.
4. Nome sugerido: `app-financeiro-db` → **Create**.
5. *(Opcional)* O próprio Worker (`backend/worker.js`) cria todas as 9 tabelas e semeia as configurações, categorias, contas e caixinhas automaticamente no primeiro acesso! Se preferir criar antes pelo console da Cloudflare, abra a aba **Console** do seu banco D1, cole o conteúdo de [`backend/schema.sql`](../backend/schema.sql) e clique em **Execute**.

---

### 1.2 Publicar o Cloudflare Worker (2 opções)

#### Opção A — Conectar direto ao GitHub (publica Site + API juntos automaticamente)

1. No painel da Cloudflare, vá em **Compute (Workers) → Workers & Pages → Create**.
2. Escolha **Import a repository (Connect to Git)** e selecione o repositório `app-financeiro`.
3. O arquivo [`wrangler.toml`](../wrangler.toml) na raiz já configura:
   - `main = "backend/worker.js"` (API)
   - `[assets] directory = "./site"` (Frontend)
4. Após o primeiro deploy, abra o Worker criado → **Settings → Bindings → Add**:
   - Tipo: **D1 database**
   - Variable name: `DB`
   - D1 database: selecione `app-financeiro-db`
   - Clique em **Deploy / Save**.
5. Pronto! Ao abrir a URL `https://app-financeiro.<seu-subdominio>.workers.dev`, o site e a API `/api` já estarão funcionando juntos sem precisar digitar a URL do servidor!

#### Opção B — Criar o Worker pelo navegador (colando `backend/worker.js`)

1. No painel da Cloudflare, vá em **Compute (Workers) → Workers & Pages → Create → Create Worker**.
2. Dê o nome `app-financeiro-api` → **Deploy**.
3. Clique em **Edit Code**, apague o código de exemplo e cole todo o conteúdo de [`backend/worker.js`](../backend/worker.js) → clique em **Deploy** (canto superior direito).
4. Volte para a página do Worker → **Settings → Bindings → Add**:
   - Tipo: **D1 database**
   - Variable name: `DB`
   - D1 database: `app-financeiro-db`
   - Clique em **Save**.
5. Copie a URL do seu Worker (ex.: `https://app-financeiro-api.<seu-subdominio>.workers.dev`).

---

## Parte 2 — Conectar o Frontend e Criar o Administrador Inicial

1. Abra o app (pela URL do Cloudflare Worker ou pelo GitHub Pages).
2. Se estiver usando o GitHub Pages:
   - Cole a URL do seu Worker na tela **"Conectar ao servidor"** → **Testar e salvar** (ou defina `API_URL_PADRAO` em [`site/assets/js/config.js`](../site/assets/js/config.js) para não precisar colar em cada dispositivo).
3. Como o banco D1 começa sem usuários, o app abrirá automaticamente a tela **"Criar acesso administrador"**:
   - Preencha **Nome**, **E-mail** e **Senha** (mínimo 6 caracteres) → **Criar administrador**.
4. Faça login com o e-mail e a senha recém-criados.
5. Para adicionar outros usuários da família/equipe (`admin`, `editor` ou `leitor`), acesse o menu **Acessos → Novo usuário**.

---

## Parte 3 — Publicar via Linha de Comando (Wrangler CLI — Opcional)

Caso tenha Node.js instalado na máquina e prefira usar o terminal:

```bash
# 1. Login na Cloudflare
npx wrangler login

# 2. Criar o banco D1 (copie o database_id retornado para o wrangler.toml)
npx wrangler d1 create app-financeiro-db

# 3. Executar o schema SQL (opcional, pois o Worker tambem auto-inicializa)
npx wrangler d1 execute app-financeiro-db --remote --file=./backend/schema.sql

# 4. Publicar o Worker + Site estatico
npx wrangler deploy
```

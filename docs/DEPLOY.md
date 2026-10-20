# Guia de publicação (do zero ao ar)

Duas partes independentes:

```
   Planilha (Google Sheets)  ←  dados
        ▲
        │  HTTPS / JSON
        │
   Google Apps Script          ←  API (backend)
        ▲
        │  HTTPS / JSON
        │
   GitHub Pages                ←  interface (frontend)
```

---

## Parte 1 — Publicar a API (Google Apps Script)

### 1.0 Criar a planilha do zero

Você tem **três formas** de começar. Escolha a que preferir:

#### Opção C — o app cria a planilha pelo navegador (mais simples, sem menu)

1. <https://script.google.com> → **Novo projeto**.
2. Cole os 3 arquivos (ver 1.1).
3. **Publicar → Implantar como aplicativo da web**:
   - Tipo: `Web app`
   - Executar como: `Eu`
   - Quem tem acesso: `Qualquer pessoa`
   - *(não precisa de planilha nenhuma para publicar)*
4. Copie a URL `/exec` e abra o app.
5. Na tela **"Conectar ao servidor"**, cole a URL → **Testar e salvar**.
6. O app detecta que ainda não há planilha e oferece **"Criar a planilha"**.
   Clique, dê um nome, e o app cria a planilha, monta as 9 abas, semeia
   categorias/contas/caixinhas e cria a aba `Config`.
7. Na sequência o app pede o **administrador** (nome, e-mail, senha) e você
   entra.

> Na primeira criação o Google pode pedir autorização ("O Google verificará sua
> identidade") → **Avançado → Ir para o projeto (não seguro) → Permitir**.

#### Opção A — script vinculado à planilha (menu na planilha)

1. Crie uma planilha em branco em <https://sheets.new>.
2. **Extensões → Apps Script** (o script fica vinculado a ela).
3. Cole os 3 arquivos (ver 1.1).
4. **Recarregue a planilha** → aparece o menu **Financeiro** na barra superior.
5. **Financeiro → 3. Configurar planilha (criar abas)** → cria tudo e pede o admin.

#### Opção B — script avulso + planilha que você já tem

1. <https://script.google.com> → Novo projeto → cole os 3 arquivos.
2. Escolha a função **`vincularPlanilha`** → **Executar** → cole o ID/URL da
   planilha que você já tem.
3. Escolha a função **`configurarPlanilha`** → **Executar**.

> ⚠️ **O menu "Financeiro" só aparece em scripts vinculados a uma planilha.**
> Se você criou o script em script.google.com, o Google **nunca** mostra o menu
> dentro de planilhas. Nesse caso use o botão **Executar** no editor do Apps
> Script ou a **Opção C** (tudo pelo navegador, sem menu).

### 1.1 Instalar os arquivos

Você tem duas opções — **um arquivo só** (mais simples) ou **3 arquivos separados** (melhor para manutenção).

#### Opção 1 — arquivo único (recomendado para começar)

1. Copie tudo de
   <https://raw.githubusercontent.com/BenehRodrigues/app-financeiro/main/backend/TODOS_OS_SCRIPTS.gs>
2. No Apps Script: **Arquivo → + → Script**, renomeie para `Backend` e cole.
3. Salve.

> O arquivo único é a concatenação de `Utils.gs` + `Setup.gs` + `Code.gs`.
> Passa pelos mesmos 108 testes (`tests/backend.test.html`).

#### Opção 2 — 3 arquivos separados

Crie três arquivos (`+` → *Script*) e cole o conteúdo de:
| arquivo no repo | nome do arquivo no Apps Script |
|---|---|
| `backend/Utils.gs` | `Utils` |
| `backend/Setup.gs` | `Setup` |
| `backend/Code.gs` | `Code` |

Depois, em **Configurações do projeto** (ícone de engrenagem):
- **Fuso horário**: `America/Sao_Paulo`
- **Mostrar o arquivo de manifesto `appsscript.json`**: ative e cole o conteúdo
  de `backend/appsscript.json` (opcional, mas recomendado).

### 1.2 Vincular / configurar a planilha

Se você usou a **Opção A**, a planilha já está vinculada: pule para 1.3.

Se você quer **usar uma planilha que já existe**:

1. Na planilha onde o script está instalado: **Financeiro → 2. Vincular planilha existente**
   → cole o ID ou a URL → **OK**.
2. **Financeiro → 3. Configurar planilha (criar abas)** → cria tudo.
   - Se ainda não houver usuário, ele pergunta nome/e-mail/senha do administrador.

> Se o script foi criado **avulso** (script.google.com), rode `vincularPlanilha`
> e `configurarPlanilha` pelo botão **Executar** do editor.

### 1.2.1 Não sabe o que aconteceu? Rode o diagnóstico

**Financeiro → Diagnostico** (ou execute a função `diagnostico`). Ela mostra:

- se o script está vinculado a uma planilha;
- qual planilha está em uso (nome, ID e URL);
- quais abas existem e quantas linhas têm;
- quais abas faltam;
- quantos usuários estão cadastrados.

O app só funciona quando **abas faltando = nenhuma** e **usuários ≥ 1**.


### 1.3 Publicar como Web App

1. No Apps Script: **Publicar → Implantar como aplicativo da web**.
2. Clique em **Nova implantação**.
3. Configuração:
   - **Tipo**: `Web app`
   - **Executar como**: `Eu` (a conta dona da planilha)
   - **Quem tem acesso**: `Qualquer pessoa`

   > ⚠️ "Qualquer pessoa" é seguro aqui: o Apps Script só *transporta* os dados.
   > Quem só consegue ver alguma coisa é quem apresenta **e-mail + senha
   > válidos na aba `Acessos`** — a validação acontece no servidor, antes de
   > qualquer leitura da planilha.
4. **Implantar** → autorize o Google (aparece uma tela de permissão: *“O Google
   verificará sua identidade”* → **Avançado** → **Ir para o projeto (não
   seguro)** → **Permitir**).
5. Copie a **URL do aplicativo web**:

   ```
   https://script.google.com/macros/s/AKfycXXXXXXXXXXXXXXXX/exec
   ```

   É essa URL que o app usa. Guarde.

### 1.4 Testar a API antes de publicar o front

Abra a URL no navegador. Se a resposta for um JSON parecido com:

```json
{"ok":true,"app":"Controle Financeiro","versao":"1.0.0","dica":"Use POST (JSON) ..."}
```

a API está no ar. Se aparecer aviso de acesso, é porque o script ainda não foi
autorizado: rode `Financeiro → Testar conexão` na planilha.

### 1.5 Atualizar o código depois

Quando você alterar o `Code.gs`:

1. **Publicar → Gerenciar implantações**
2. Clique na implantação → **✏️ Editar** → **Nova versão** → **Implantar**
3. Confirme em **Publicar → Implantar como aplicativo da web** que a versão nova
   está ativa.

> Sem criar uma **nova versão**, as alterações **não** entram no ar. Esse é o
> erro nº 1 de quem publica Apps Script.

---

## Parte 2 — Publicar o front-end (GitHub Pages)

### 2.1 Criar o repositório

```bash
git init
git add .
git commit -m "Controle Financeiro - versao inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/app-financeiro.git
git push -u origin main
```

### 2.2 Ativar o GitHub Pages

No repositório: **Settings → Pages → Build and deployment → Source: `GitHub Actions`**.

O arquivo `.github/workflows/pages.yml` já está pronto: ele publica **apenas a
pasta `site/`** (o backend e os documentos ficam fora do site público).

Acompanhe em **Actions**. Em ~1 minuto o site fica no ar em:

```
https://SEU_USUARIO.github.io/app-financeiro/
```

> Se o repositório for privado, o Pages exige plano pago. Alternativa: use
> Cloudflare Pages ou Netlify (o repositório `site/` é estático puro, funciona
> em qualquer hospedagem estática).

### 2.3 Apontar o app para a sua API

Duas formas (pode usar as duas):

**a) Definir no código** (recomendado — não precisa colar de novo em cada
aparelho):

```js
// site/assets/js/config.js
export const API_URL_PADRAO = 'https://script.google.com/macros/s/AKfycXXXX/exec';
```

Depois é só commit + push (o GitHub Actions republica sozinho).

**b) Colar na tela:** na primeira vez que abrir o app, aparece a tela
*"Conectar ao servidor"* → cole a URL → **Testar e salvar**. A URL fica salva
no `localStorage` **daquele navegador**.

> O `API_URL_PADRAO` é só um *default*: o que o usuário digitar na tela tem
> prioridade. Isso permite trocar de backend (ex.: uma planilha de testes)
> sem recompilar nada.

### 2.4 Domínio próprio (opcional)

1. Crie um repositório com nome `<seuusuario>.github.io` e publique o `site/`
   lá, **ou**
2. No repositório do app: **Settings → Pages → Custom domain**, informe
   `financas.seudominio.com` e crie o registro CNAME apontando para
   `SEU_USUARIO.github.io`.

---

## Parte 3 — Checklist de lançamento

- [ ] `Financeiro → 3. Configurar planilha` executado (ou `criarNovaPlanilha` rodado)
- [ ] Administrador criado
- [ ] Web App implantado com acesso **"Qualquer pessoa"**
- [ ] URL do Web App testada no navegador (retorna JSON)
- [ ] Repositório enviado ao GitHub
- [ ] **Settings → Pages → Source: GitHub Actions**
- [ ] Site publicado e abrindo sem erro de console
- [ ] URL da API configurada (`config.js` ou tela inicial)
- [ ] Login funcionando no celular (teste em rede móvel, não só no Wi-Fi)
- [ ] Usuários reais criados com o perfil correto
- [ ] Aba `Acessos` revisada (ninguém com `admin` além do necessário)

---

## Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| **O menu "Financeiro" não aparece** | o script é **avulso** (script.google.com): o Google só mostra menu de script vinculado a uma planilha | use a **Opção C** (tudo pelo navegador) ou rode `criarNovaPlanilha` / `configurarPlanilha` pelo botão **Executar** do editor |
| **"Nenhuma planilha vinculada"** | falta vincular/criar a planilha | pelo app: *"Conectar ao servidor" → "Criar a planilha"*. Ou no editor: `criarNovaPlanilha` |
| **"Planilha não vinculada" ao configurar** | o `SPREADSHEET_ID` não foi gravado | use o menu **Diagnostico**: ele mostra a planilha em uso e as abas faltantes |
| **As abas não foram criadas** | `configurarPlanilha` rodou em outra planilha | use o app: ele detecta e recria; ou rode `diagnostico` para ver qual planilha está em uso |
| **"Nao consegui criar a planilha"** | o script ainda não foi autorizado a criar planilhas | autorize o app na tela do Google ("Avançado → Ir para o projeto") e tente de novo |
| "Nao foi possivel falar com o servidor" | URL errada ou API não publicada | reimplemente o Web App; confira se termina em `/exec` |
| "Resposta invalida do servidor" | a URL aponta para `.../dev` em vez de `.../exec` | use a URL de implantação |
| "Sessao expirada" na hora | o app está usando `localhost` e `file://` | sirva por HTTP (o GitHub Pages resolve) |
| Login responde "Nao foi possivel entrar" | hash/salt fora do lugar | recrie o usuário pelo app ou pelo menu *Gerar hash de senha* |
| "Erro 403 (Forbidden)" no console | sessão expirada no meio do uso | faça login de novo; se repetir, reduza a validade da sessão |
| Mudanças no `Code.gs` não aparecem | faltou criar nova versão | **Publicar → Gerenciar implantações → Nova versão** |
| CORS no console | o fetch foi feito com `application/json` | o app já envia `text/plain`; não edite isso |
| App abre e volta para o login | token expirado (30 dias) | login normal, é o esperado |

### Permitir a API em vários navegadores

O Web App com acesso *"Qualquer pessoa"* aceita requisições de qualquer origem.
Se o seu Google Workspace **bloquear** web apps para domínios externos
(com o Apps Script de terceiros desativado), use **"Apenas usuários do domínio
@seudominio.com"** e publique o GitHub Pages em um domínio do mesmo domínio
corporativo, ou use a opção *Aplicativo da web para conta do Google Cloud* para
apps internos.

---

## Manutenção

### Atualizar o app
```bash
git pull
# edite, teste localmente (basta abrir site/index.html via um servidor simples)
git add . && git commit -m "ajuste" && git push
```
O GitHub Actions republica em ~1 minuto.

### Testar localmente sem publicar
```bash
# qualquer servidor estático na raiz do projeto
npx serve site
# ou
python -m http.server 8080 --directory site
```
Depois abra `http://localhost:8080` e cole a URL da API na tela inicial.
(Use sempre `http://localhost`, **nunca** `file://`.)

### Backup da planilha
*Arquivo → Fazer uma cópia*, ou baixe em *XLSX* pelo
*Arquivo → Baixar → Microsoft Excel*. O histórico de versões do Sheets já
protege contra erro de digitação.

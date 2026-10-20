# 🚀 Guia de implantação

Este guia mostra como publicar o **Gestor Financeiro** de ponta a ponta: backend no Google Apps Script e site no GitHub Pages.

---

## 📋 Pré-requisitos

- Conta Google (para o Apps Script e a planilha);
- Conta no GitHub (para hospedar o site);
- A planilha já existente (os dados são lidos dela).

---

## 1️⃣ Backend — Google Apps Script

### 1.1 Criar o projeto
1. Abra sua planilha no Google Sheets.
2. No menu: **Extensões → Apps Script**.
3. Apague o conteúdo padrão de `Code.gs`.
4. Cole todo o conteúdo de **`apps-script/Code.gs`**.
5. Em **appsscript.json**: clique no engrenagem ⚙️ do projeto → marque *"Mostrar o arquivo de manifesto"*. Substitua o conteúdo pelo de **`apps-script/appsscript.json`**.

### 1.2 Definir a chave de acesso (recomendado)
1. No editor do Apps Script: **☰ (menu) → Configurações do projeto** (ícone de engrenagem).
2. Role até **Propriedades do script** → **Adicionar propriedade de script**:
   - Nome: `APP_KEY`
   - Valor: uma string aleatória (ex.: `a7F3kL9mQ2xP8zR1tY6w`)
3. Salve.

> Use a **mesma** string em `js/config.js` → `CONFIG.APP_KEY`.

### 1.3 Implantar como Aplicativo da Web
1. **Implantar → Nova implantação** (ícone de engrenagem ao lado de "Implantar").
2. Selecione o tipo **Aplicativo da Web**.
3. Preencha:
   - **Descrição**: `Gestor Financeiro v1`
   - **Executar como**: `Eu`
   - **Quem tem acesso**: `Qualquer pessoa`
4. Clique em **Implantar** e autorize o acesso.
5. Copie a **URL do aplicativo da web** (termina em `/exec`).

> A cada alteração no código, faça **Implantar → Gerenciar implantações → Editar → Versão: Nova versão → Implantar**, usando sempre a mesma implantação para manter a URL.

### 1.4 Apontar a URL no frontend
Abra **`js/config.js`** e cole a URL:

```js
APPS_SCRIPT_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
```

---

## 2️⃣ Testar o backend

Com a URL em mãos, teste no navegador (substitua a URL e a chave):

```
https://script.google.com/macros/s/XXXXXXXX/exec?key=SUA_CHAVE&action=ping
```

Esperado:

```json
{"ok":true,"pong":true}
```

Se retornar `{"ok":false,"error":"unauthorized"}`, a chave não confere.
Se der erro de permissão, refaça o passo 1.3 autorizando a conta.

Agora teste a leitura:

```
https://script.google.com/macros/s/XXXXXXXX/exec?key=SUA_CHAVE&action=list
```

Você verá um JSON com `lancamentos`, `dashboard` e `caixinha`.

> Na primeira chamada, o Apps Script cria automaticamente a coluna **ID** (H) na aba `Lançamentos` e a aba **Caixinha**.

---

## 3️⃣ Frontend — GitHub Pages

### 3.1 Criar o repositório
1. No GitHub, clique em **New repository**.
2. Nome sugerido: `gestor-financeiro`.
3. Marque **Public** (necessário para Pages no plano gratuito).
4. Inicializar **sem** README (evita conflito na primeira subida).

### 3.2 Enviar os arquivos
Na pasta do projeto (`C:\Users\aspra\Pictures\App Financeiro`):

```bash
git init
git add .
git commit -m "Gestor Financeiro: app + backend"
git branch -M main
git remote add origin https://github.com/<SEU_USUARIO>/gestor-financeiro.git
git push -u origin main
```

> Se não tiver o `git` instalado, baixe em <https://git-scm.com/>. Também dá para arrastar os arquivos direto pela interface web do GitHub (botão **Add file → Upload files**).

### 3.3 Publicar no Pages
1. No repositório: **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Branch: `main` / pasta `/ (root)` → **Save**.
4. Aguarde ~1 minuto. O endereço aparecerá no topo:
   `https://<SEU_USUARIO>.github.io/gestor-financeiro/`

Abra esse endereço em qualquer dispositivo. 🎉

---

## 4️⃣ Verificação final

- [ ] A tela carrega os lançamentos da planilha;
- [ ] O seletor de mês altera os KPIs e os gráficos;
- [ ] **Incluir** um lançamento → ele aparece na planilha;
- [ ] **Editar** um lançamento → a planilha é atualizada;
- [ ] **Excluir** um lançamento → a linha some da planilha;
- [ ] **Caixinha**: aporte/retirada/meta gravam na aba `Caixinha`;
- [ ] Editar **Caixa / Reserva Inicial** grava em `Dashboard!C22`;
- [ ] Testar no celular (responsivo).

---

## 🛠️ Troubleshooting

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| "Não foi possível conectar à planilha" | URL não configurada | Preencher `CONFIG.APPS_SCRIPT_URL` em `js/config.js` |
| `unauthorized` | Chave divergente | Igualar `APP_KEY` no Code.gs e no `config.js` |
| Dados não carregam no navegador | CORS | O app já tenta fallback JSONP; verifique a URL e o acesso "Qualquer pessoa" |
| `Chart.js` não carrega | CDN bloqueado | Verifique a internet; os KPIs/tabela continuam funcionando |
| Alterações não aparecem na planilha | Permissão do Apps Script | Reautorize a implantação (Executar como: Eu) |
| IDs duplicados | Coluna H editada manualmente | Não edite a coluna `ID`; recrie se necessário |

---

## 🔐 Boas práticas

- Mantenha a planilha **restrita** (o Apps Script acessa com sua conta);
- Troque a `APP_KEY` padrão;
- Faça backup da planilha antes de grandes alterações;
- Ao atualizar o código, crie uma **nova versão** na mesma implantação para não mudar a URL.

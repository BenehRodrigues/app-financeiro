# 💸 Gestor Financeiro

Aplicação web **responsiva** de controle financeiro pessoal, com dados sincronizados em tempo real com uma planilha do **Google Sheets**.

> **Banco de dados = Google Sheets.** O app lê os lançamentos da planilha e grava de volta nela a cada inclusão, edição ou exclusão — inclusive a *Caixinha Emergencial*.

---

## ✨ O que o app faz

- **Dashboard financeiro** com visão mensal e anual:
  - Receitas, despesas, saldo e % de comprometimento do mês selecionado;
  - Gráfico **Receitas × Despesas** por mês;
  - Gráficos de **despesas e receitas por categoria**;
  - **Projeção de caixa** (12 meses) e projeção de receitas/despesas (média móvel);
  - **Caixa Final Projetado** e **Caixa Futuro**.
- **Caixinha Emergencial**: meta, saldo, progresso e aportes/retiradas (gravados em aba própria da planilha).
- **CRUD completo de lançamentos**: incluir, editar e excluir — tudo refletido na planilha original.
- **Filtros** por tipo, categoria e status (Realizado/Previsto).
- **100% responsivo**: funciona em celular, tablet e desktop.

---

## 🏗️ Arquitetura

```
┌───────────────────────────┐        HTTPS (JSON)        ┌──────────────────────────┐
│  Frontend estático         │  ───────────────────────▶  │  Google Apps Script      │
│  (GitHub Pages)            │  ◀───────────────────────  │  (Web App /exec)         │
│  index.html + CSS + JS     │        GET / POST          │  Code.gs                 │
└───────────────────────────┘                             └────────────┬─────────────┘
                                                                        │ Sheets API
                                                                        ▼
                                                          ┌──────────────────────────┐
                                                          │  Google Sheets (BD)       │
                                                          │  • Lançamentos            │
                                                          │  • Dashboard              │
                                                          │  • Caixinha               │
                                                          └──────────────────────────┘
```

- **Frontend leve**: HTML + CSS + JavaScript puro (sem build, sem framework). Gráficos via [Chart.js](https://www.chartjs.org/) (CDN).
- **Backend**: um único `Code.gs` no Apps Script, implantado como *Aplicativo da Web*. É ele quem lê e grava na planilha com segurança (a chave fica no servidor, nunca no banco).
- **Segurança**: chave compartilhada (`APP_KEY`) validada no Apps Script.

---

## 📁 Estrutura do projeto

```
App Financeiro/
├── index.html                 # Interface (SPA)
├── styles.css                 # Tema fintech moderno + responsivo
├── js/
│   ├── config.js              # ⚙️ CONFIG: ID da planilha, URL do Apps Script, chave
│   ├── format.js              # Formatação de moeda/data/mês
│   ├── api.js                 # Cliente HTTP (GET/POST + fallback JSONP)
│   ├── store.js               # Regras de negócio e agregações
│   ├── charts.js              # Gráficos (Chart.js)
│   └── app.js                 # Estado, renderização e eventos
├── apps-script/
│   ├── Code.gs                # Backend do Google Apps Script
│   └── appsscript.json        # Manifesto do Apps Script
├── docs/
│   └── SETUP.md               # 🚀 Passo a passo de implantação
├── .gitignore
└── README.md
```

---

## 🚀 Como colocar no ar (resumo)

1. **Apps Script** (backend + gravação na planilha):
   - Abra a planilha → **Extensões → Apps Script**;
   - Cole o conteúdo de `apps-script/Code.gs`;
   - Defina a propriedade de script `APP_KEY` (Arquivo → Propriedades do projeto → Propriedades do script);
   - **Implantar → Nova implantação → Aplicativo da Web** (Executar como: *Eu*; acesso: *Qualquer pessoa*);
   - Copie a URL `/exec` e cole em `js/config.js` → `CONFIG.APPS_SCRIPT_URL`.

2. **GitHub Pages** (hospedagem do site):
   - Crie um repositório e envie estes arquivos;
   - Em **Settings → Pages**, publique o branch principal (pasta `/ (root)`);
   - Pronto: `https://<usuario>.github.io/<repo>/`.

> Instruções completas, com telas e troubleshooting: **[docs/SETUP.md](docs/SETUP.md)**.

---

## 🧪 Rodando localmente

O app faz chamadas cross-origin ao Apps Script, então abra por um servidor local (não por `file://`):

```bash
# Qualquer um destes:
python -m http.server 8000
npx serve .
```

Depois acesse `http://localhost:8000`.

---

## ⚙️ Configuração principal (`js/config.js`)

| Chave | Descrição |
|-------|-----------|
| `SPREADSHEET_ID` | ID da sua planilha Google (já preenchido) |
| `APPS_SCRIPT_URL` | URL `/exec` do Apps Script implantado |
| `APP_KEY` | Chave secreta compartilhada (a mesma do Apps Script) |
| `DASH_SALDO_LIQUIDO` | Célula do *Saldo Líquido Mensal* (`C21`) |
| `DASH_RESERVA_INICIAL` | Célula do *Caixa / Reserva Inicial* (`C22`, editável) |
| `MESES_MEDIA` | Meses usados na média de projeção (padrão `3`) |
| `MESES_PROJECAO` | Horizonte da projeção (padrão `12`) |

---

## 📝 Contrato de dados

**Lançamentos** (aba `Lançamentos`): `Data | Mês/Ano | Tipo | Categoria | Descrição | Valor (R$) | Status | ID`

- `Tipo`: `Receita`, `Gasto Fixo`, `Gasto Variável`, `Cartão de Crédito`, `Empréstimo`
- `Status`: `Realizado`, `Previsto`
- `ID` (coluna H): criado automaticamente na primeira execução; usado para editar/excluir sem ambiguidade.

**Caixinha** (aba `Caixinha`, criada automaticamente): `Meta Emergencial` (B1) + `Data | Tipo | Descrição | Valor (R$) | ID` a partir da linha 4. Aportes são positivos, retiradas negativas.

**Dashboard**: o app lê `C21` (Saldo Líquido Mensal) e `C22` (Caixa / Reserva Inicial). Ao editar a reserva pelo app, o valor é gravado em `C22`.

---

## ❓ Perguntas frequentes

**O app modifica minha planilha?** Sim — é o objetivo. Inclusões, edições e exclusões são gravadas diretamente na aba `Lançamentos`. Na primeira execução, o Apps Script cria a coluna `ID` (H) e a aba `Caixinha`, se não existirem.

**A planilha precisa ficar pública?** Não. Basta que o Apps Script (rodando com sua conta) tenha acesso. Manter a planilha restrita é mais seguro.

**Funciona offline?** A sincronização exige internet (para falar com o Apps Script). Sem conexão, o app não carrega dados.

**É seguro colocar a chave no site?** A chave fica visível no código do cliente, então ela é uma proteção contra uso casual, não uma barreira real. Para uso pessoal, é suficiente. Não use este app para dados corporativos sensíveis.

---

Feito com HTML, CSS e JavaScript puro + Google Apps Script. 🚀

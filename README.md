# Controle Financeiro

Web app de controle financeiro pessoal/familiar com **banco de dados 100% no Google Sheets**.

- **Interface**: HTML + CSS + JavaScript puro (ES Modules) — sem build, sem dependências
- **Backend**: Google Apps Script (Web App) — única ponte com a planilha
- **Hospedagem**: GitHub Pages (grátis, estático)
- **Acesso**: e-mail + senha com hash SHA-256, tabela de acessos dentro da própria planilha

```
GitHub Pages  ──HTTP──▶  Apps Script  ──Sheets API──▶  Google Sheets
  (frontend)              (backend)                      (banco)
```

---

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Painel** | KPIs do mês, receitas × despesas (12 meses), rosca por categoria, ranking de gastos, próximos vencimentos, gastos fixos, **projeção** do mês, resumo das caixinhas |
| **Lançamentos** | CRUD completo, filtros (mês, tipo, categoria, conta, status, forma, busca), paginação, ordenação, **parcelamento** automático, duplicar, marcar pago/pendente, **exportar CSV** |
| **Categorias** | CRUD, cor, grupo, **orçamento mensal** com barra de consumo |
| **Contas** | CRUD, limite de cartão, dia de vencimento, uso do mês |
| **Caixinhas** | metas, prazos, aportes/resgates, **saldo**, **projeção** (quanto guardar por mês para chegar na meta) |
| **Relatórios** | Annual, evolução mensal, fechamento com acumulado, por categoria/conta/forma de pagamento, maiores despesas, CSV |
| **Acessos** | CRUD de usuários com perfis `admin` / `editor` / `leitor` (admin) |
| **Configurações** | nome do app, moeda, tema, atualização automática, limpeza de dados (admin) |

Tudo é **responsivo**: sidebar no desktop, barra inferior no celular, tabelas
viram listas, modais viram folhas.

---

## Estrutura do repositório

```
app-financeiro/
├── site/                      ← é isto que o GitHub Pages publica
│   ├── index.html
│   └── assets/
│       ├── css/styles.css
│       └── js/
│           ├── app.js         ← shell, rotas, eventos
│           ├── api.js         ← cliente do Apps Script
│           ├── store.js       ← estado central
│           ├── calc.js        ← cálculos financeiros
│           ├── charts.js      ← gráficos SVG próprios
│           ├── ui.js          ← modais, toasts
│           ├── utils.js       ← formatação, datas, ícones
│           ├── config.js      ← URL da API + configurações
│           └── views/         ← uma tela por arquivo
├── backend/                   ← Apps Script (copiar para o editor)
│   ├── TODOS_OS_SCRIPTS.gs    ← 👈 versão em 1 arquivo (cole só este)
│   ├── Utils.gs               ← schema das abas + helpers
│   ├── Setup.gs               ← cria/formata a planilha + menu
│   ├── Code.gs                ← a API (doPost/doGet)
│   └── appsscript.json
├── docs/
│   ├── PLANILHA.md            ← 👈 como montar a planilha
│   ├── DEPLOY.md              ← 👈 publicar no ar
│   └── API.md                 ← contrato da API
├── tests/
│   └── backend.test.html      ← 87 testes do backend (abre no navegador)
└── .github/workflows/pages.yml
```

### Testes

Duas suítes rodam **no navegador, sem instalar nada** (abra por `file://` ou
por um servidor local):

| Arquivo | Cobre | Testes |
|---|---|---|
| `tests/backend.test.html` | o Apps Script: schema, setup da planilha, hash, login, permissões, CRUD, parcelamento, caixinhas, correção da `Competencia` | 112 |
| `tests/calc.test.html` | o front-end: competência, resumos, projeções, caixinhas, datas | 51 |

Elas simulam o Google Apps Script e a planilha em memória, e validam os
cenários que quebram o app quando a planilha devolve datas em formatos
diferentes do esperado.

```
112 OK / 0 FALHAS   (backend)
 51 OK / 0 FALHAS   (front-end)
```

---

## Começando (resumo)

1. **Backend**: <https://script.google.com> → Novo projeto → cole **um arquivo só**
   ([`backend/TODOS_OS_SCRIPTS.gs`](backend/TODOS_OS_SCRIPTS.gs) — a concatenação
   de `Utils.gs` + `Setup.gs` + `Code.gs`) → **Publicar → Implantar como
   aplicativo da web** (*Executar como: Eu* / *Acesso: Qualquer pessoa*) →
   copie a URL `/exec`. Não precisa criar planilha nenhuma antes.
2. **Frontend**: já publicado em <https://benehrodrigues.github.io/app-financeiro/>
   (a pasta `site/` é publicada pelo workflow a cada push).
3. **Conexão**: cole a URL da API na primeira tela do app. Ele detecta se ainda
   não há planilha e **cria tudo** (abas, categorias, contas, caixinhas,
   administrador) em duas telas.

Detalhamento passo a passo: [`docs/DEPLOY.md`](docs/DEPLOY.md).
Guia da planilha: [`docs/PLANILHA.md`](docs/PLANILHA.md).

> **Não funcionou?** O menu **Financeiro** só aparece quando o script está
> *vinculado* a uma planilha (criado em *Extensões → Apps Script*). Se você
> criou o script em script.google.com, o menu nunca aparece — use o fluxo da
> **Opção C** do guia (tudo pelo navegador). Para diagnóstico, a função
> `diagnostico` mostra planilha em uso, abas faltantes e usuários cadastrados.

---

## Como o app conversa com a planilha

1. O front-end faz `POST` para o Web App com `{ acao, token, ... }`.
2. O Apps Script valida o token na aba `Sessoes` e o perfil na aba `Acessos`.
3. Só então lê/escreve nas abas de dados.
4. A resposta volta como JSON; o front recalcula a tela.

**Nenhuma credencial do Google fica no navegador** — a Service Account /
chave de API nunca é exposta. O token da sessão é a única credencial que
circula, e ele está no `localStorage` do dispositivo.

Toda gravação é **imediata na planilha**: o que você salva no app já está na
aba `Lancamentos` quando você olha o Sheets.

---

## Regras do modelo de dados

- `Valor` é **sempre positivo**; o sinal vem de `Tipo` (`Despesa`/`Receita`).
- `Competencia` (`AAAA-MM`) é derivada da `Data` — é o eixo de agrupamento.
- `Recorrente = SIM` cria um modelo: o app projeta o valor nos meses seguintes.
- `Fixo = SIM` marca os gastos que não mudam todo mês.
- `Parcelas > 1` gera N linhas ligadas por `GrupoParcelas`.
- Senhas são guardadas como `SHA-256(salt + "|" + senha)` — nunca em texto puro.

---

## Licença

Uso pessoal. Adapte à vontade.

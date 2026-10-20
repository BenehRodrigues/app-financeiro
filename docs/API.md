# API interna (Apps Script)

Endpoint único:

```
POST https://script.google.com/macros/s/{DEPLOY_ID}/exec
Content-Type: text/plain;charset=utf-8
```

Corpo: JSON `{ "acao": "...", "token": "...", ...params }`

Resposta: `{ "ok": true, ... }` ou `{ "ok": false, "erro": "...", "codigo": "..." }`

> `Content-Type` é `text/plain` de propósito: evita o preflight CORS, que o
> Apps Script não responde. O corpo continua sendo JSON.

---

## Ações públicas (sem token)

| Ação | Params | Retorno |
|---|---|---|
| `ping` | — | `{ ok, ping, servidor }` |
| `status` | — | `{ ok, semPlanilha, planilha, planilhaId, planilhaUrl, abas[], usuarios, temUsuarios, pronto }` |
| `criarplanilha` | `nome` | cria a planilha (se ainda não houver), monta as abas e devolve `{ ok, criado, planilha, id, url, abas[], temAdmin }` |
| `login` | `email`, `senha` | `{ ok, token, expiraEm, usuario }` |
| `criaradmininicial` | `nome`, `email`, `senha` | `{ ok, usuario }` — só funciona se a planilha **não tiver** nenhum usuário |

> `criarplanilha` é idempotente: se já existir uma planilha vinculada, ela é
> apenas configurada e devolvida (`criado: false`). É o que permite o app
> detectar e recuperar de uma instalação pela metade.


### Códigos de erro

| Código | Significado |
|---|---|
| `SEM_USUARIOS` | planilha sem nenhum acesso cadastrado |
| `CREDENCIAIS` | e-mail não encontrado, senha errada ou usuário inativo |
| `NAO_AUTENTICADO` | token ausente, inválido ou expirado |
| `SEM_PERMISSAO` | perfil não permite a operação |
| `DADOS` | campo obrigatório ausente ou inválido |
| `DUPLICADO` | nome/e-mail já cadastrado |
| `EM_USO` | registro vinculado a lançamentos (ex.: categoria) |
| `SEM_API` / `SEM_CONEXAO` | URL da API ausente ou inacessível |

---

## Ações autenticadas

Token: `Authorization` via corpo (`"token"`), válido por **30 dias**.
Ele fica na aba `Sessoes` e é revogado ao trocar a senha ou excluir o usuário.

### Leitura

| Ação | Retorno |
|---|---|
| `bootstrap` | `{ usuario, config, categorias[], contas[], lancamentos[], caixinhas[], movimentacoes[], agora }` |
| `listarusuarios` (admin) | `{ usuarios[] }` — sem hashes de senha |

### Lançamentos (admin, editor)

| Ação | Params | Observações |
|---|---|---|
| `salvarlancamento` | `dados{}` | `dados.ID` vazio = novo. `Parcelas > 1` cria o grupo inteiro de uma vez. |
| `excluirlancamento` | `id`, `excluirGrupo` | `excluirGrupo=true` apaga todas as parcelas do grupo. |

`dados{}`:
```json
{
  "ID": "", "Data": "2026-10-15", "Tipo": "Despesa", "Valor": 1500.00,
  "Descricao": "Aluguel", "CategoriaID": "abc", "ContaID": "def",
  "FormaPagamento": "Credito", "Parcelas": 1, "ParcelaAtual": 1,
  "Status": "Pago", "Recorrente": "NAO", "Fixo": "SIM",
  "CaixinhaID": "", "GrupoParcelas": "", "Obs": ""
}
```

### Categorias / Contas / Caixinhas (admin, editor)

| Ação | Params |
|---|---|
| `salvarcategoria` | `dados{ID,Nome,Tipo,Grupo,Cor,OrcamentoMensal,Ativo,Obs}` |
| `excluircategoria` | `id` (falha com `EM_USO` se houver lançamentos) |
| `salvarconta` | `dados{ID,Nome,Tipo,Instituicao,Limite,DiaVencimento,Cor,Ativo,Obs}` |
| `excluirconta` | `id` |
| `salvarcaixinha` | `dados{ID,Nome,Descricao,Meta,Prazo,SaldoInicial,Cor,Ativo}` |
| `excluircaixinha` | `id` (apaga também as movimentações) |
| `movimentarcaixinha` | `dados{CaixinhaID,Tipo,Data,Valor,Descricao}` |
| `excluirmovimentacao` | `id` |

### Usuários (admin)

| Ação | Params | Observações |
|---|---|---|
| `salvarusuario` | `dados{ID,Nome,Email,Perfil,Ativo,Senha}` | `Senha` vazia = mantém a senha. Trocar a senha revoga as sessões do usuário. |
| `excluirusuario` | `id` | não permite excluir a si mesmo |

### Minha senha (qualquer perfil)

| Ação | Params |
|---|---|
| `trocarsenha` | `senhaAtual`, `senhaNova` (mín. 6) |

### Configuração (admin)

| Ação | Params |
|---|---|
| `salvarconfig` | `chave`, `valor` |
| `limpar` | `confirmar: "APAGAR TUDO"` (apaga lançamentos, caixinhas e movimentações) |

---

## Formatos

| Tipo | Na planilha | Na API |
|---|---|---|
| Data | `dd/mm/yyyy` | `"2026-10-15"` (ISO) |
| Data/hora | `dd/mm/yyyy hh:mm` | `"2026-10-15 14:32:00"` |
| Moeda | `#,##0.00` | `1500` (número, sempre positivo) |
| Boolean | `SIM` / `NAO` | `"SIM"` / `"NAO"` |
| Competência | texto `AAAA-MM` | `"2026-10"` |
| Cor | `#22c55e` | string |

---

## Regras de permissão

| Ação | admin | editor | leitor |
|---|:--:|:--:|:--:|
| `bootstrap` | ✅ | ✅ | ✅ |
| `salvar/excluir` lançamentos, categorias, contas, caixinhas | ✅ | ✅ | ❌ |
| `salvarusuario`, `excluirusuario`, `listarusuarios` | ✅ | ❌ | ❌ |
| `salvarconfig`, `limpar` | ✅ | ❌ | ❌ |
| `trocarsenha` | ✅ | ✅ | ✅ |

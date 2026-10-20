# Como montar a planilha (o banco de dados do app)

Este guia explica **como a planilha deve ser estruturada** e por que ela é a única
fonte de verdade do aplicativo.

> **Resumo:** você **não precisa** criar as abas manualmente. O script do backend
> (`backend/Setup.gs`) cria e formata tudo sozinho em um clique
> (**Financeiro → 3. Configurar planilha**). Este documento existe para você
> entender o resultado, criar manualmente se preferir, e não quebrar nada depois.

---

## 1. Por que a planilha é o banco de dados

| | Planilha como banco | Banco tradicional (Postgres, Firebase…) |
|---|---|---|
| Custo | R$ 0 | servidor, banco, backup, mensalidade |
| Quem enxerga | você e quem você autorizar | só o app |
| Auditoria | cada alteração fica no histórico de versões | precisa montar log |
| Exportar para Excel | já é Excel | precisa exportar |
| Consultas extras | fórmulas do Sheets | SQL |

O preço disso: a planilha é limitada a ~10 milhões de células (para uso pessoal
isso é **mais de 50 anos** de lançamentos) e cada gravação é uma operação de API
(limite do Google: ~60 chamadas/min por usuário — o app grava em lote e nunca
dispara milhares de chamadas).

---

## 2. Criando a planilha (passo a passo)

Você pode deixar o **app criar a planilha** (Opção C), rodar o script (Opções A
e B) ou montar tudo à mão (seção 5).

### Opção C — o app cria a planilha (mais simples, sem menu)

1. <https://script.google.com> → **Novo projeto**.
2. Cole os 3 arquivos do backend:

   | arquivo no repo | nome no Apps Script |
   |---|---|
   | `backend/Utils.gs` | `Utils` |
   | `backend/Setup.gs` | `Setup` |
   | `backend/Code.gs` | `Code` |

3. Em **Configurações do projeto**, defina o fuso como `America/Sao_Paulo`.
4. **Publicar → Implantar como aplicativo da web** → Executar como: `Eu` ·
   Acesso: `Qualquer pessoa`. *(não precisa de planilha para publicar)*
5. Copie a URL `/exec`, abra o app e cole na tela **"Conectar ao servidor"**.
6. O app oferece **"Criar a planilha"** → digite um nome → ele cria a planilha,
   monta as 9 abas, semeia categorias/contas/caixinhas e cria a aba `Config`.
7. Na sequência, o app pede o **administrador** e você entra.

### Opção A — o script cria a planilha (função `criarNovaPlanilha`)

1. <https://script.google.com> → **Novo projeto** → cole os 3 arquivos.
2. Escolha a função **`criarNovaPlanilha`** na barra do editor → **Executar**.
3. O script pergunta o **nome da planilha** e faz tudo:
   - cria a planilha;
   - guarda o ID em Script Properties (é por isso que o app aponta para ela);
   - cria as 9 abas com cabeçalhos, tipos e validações;
   - aplica formatação de data, moeda e texto;
   - insere categorias, contas e caixinhas padrão;
   - cria a aba `Config` com as configurações do app;
   - pergunta nome/e-mail/senha do **primeiro administrador**;
   - mostra a **URL** da planilha criada.

### Opção B — você já tem uma planilha

1. Abra a planilha → **Extensões → Apps Script** (o script fica vinculado nela).
2. Cole os 3 arquivos (tabela acima).
3. **Recarregue a planilha** → aparece o menu **Financeiro**.
4. **Financeiro → 3. Configurar planilha (criar abas)**.
   - O script usa a planilha onde ele está instalado (não precisa de nenhum passo extra).

> ⚠️ **O menu "Financeiro" só aparece em scripts vinculados a uma planilha.**
> Em script avulso (script.google.com) o Google nunca mostra o menu dentro de
> planilhas — nesse caso use a **Opção C** ou o botão **Executar** do editor.

### Se algo deu errado

**Financeiro → Diagnostico** (ou a função `diagnostico`) mostra em uma tela:
se o script está vinculado a uma planilha, qual planilha está em uso (nome, ID e
URL), quais abas existem, quantas linhas têm, quais abas faltam e quantos
usuários estão cadastrados.

**O app só funciona quando: `abas faltando = nenhuma` e `usuários ≥ 1`.**



---

## 3. Mapa das abas

```
Planilha "Finanças da Família"
├── Config          → configurações do app (chave/valor)
├── Acessos         → quem pode entrar (login, senha com hash, perfil)
├── Categorias      → grupos de despesa/receita + orçamento mensal
├── Contas          → conta corrente, poupança, cartões, carteira
├── Lancamentos     → ★ o coração: todo dinheiro que entrou e saiu
├── Caixinhas       → envelopes de objetivo (viagem, reserva…)
├── Movimentacoes   → entradas e saídas de cada caixinha
├── Sessoes         → tokens de login (renove/revogue aqui)
└── Log             → auditoria: quem fez o quê
```

---

## 4. Especificação de cada aba

### 4.1 `Config` — Configurações

| Coluna | Tipo | Observação |
|---|---|---|
| `ID` | texto | identificador único (interno) |
| `Chave` | texto | nome do parâmetro, ex.: `simbolo_moeda` |
| `Valor` | texto | valor do parâmetro |
| `Descricao` | texto | texto de ajuda (não é usado pelo app) |

Chaves que o app entende:

| Chave | Padrão | Para que serve |
|---|---|---|
| `nome_app` | `Controle Financeiro` | título exibido no topo |
| `simbolo_moeda` | `R$` | prefixo dos valores |
| `locale` | `pt-BR` | formato de data e número |
| `mostrar_centavos` | `SIM` | `NAO` mostra valores arredondados |
| `atualizacao_auto_seg` | `60` | refresh automático da tela (segundos) |
| `permitir_parcelas` | `SIM` | liga/desliga o parcelamento |
| `tema_padrao` | `escuro` | `escuro` ou `claro` |
| `cor_primaria` | `#22c55e` | cor de destaque |
| `alerta_saldo_negativo` | `SIM` | destaca saldo negativo |
| `mostrar_projecao` | `SIM` | exibe a projeção no painel |

### 4.2 `Acessos` — Controle de acesso

| Coluna | Tipo | Observação |
|---|---|---|
| `ID` | texto | id interno |
| `Nome` | texto | nome exibido |
| `Email` | texto | **login** (minúsculo, único) |
| `Perfil` | texto | `admin` \| `editor` \| `leitor` |
| `Ativo` | texto | `SIM` \| `NAO` |
| `Salt` | texto | sal aleatório da senha |
| `SenhaHash` | texto | **SHA-256(salt + "|" + senha)** |
| `CriadoEm` | data/hora | automático |
| `UltimoAcesso` | data/hora | automático |
| `Obs` | texto | livre |

> A senha **nunca** é gravada em texto puro. O app calcula o hash e grava só o
> resultado + o sal. Se você criar usuário direto na planilha, use o menu
> **Financeiro → Gerar hash de senha**, que devolve o par `Salt` + `SenhaHash`
> já pronto para colar.

**Permissões:**

| Perfil | Pode |
|---|---|
| `admin` | tudo: usuários, configurações, lançamentos, limpeza de dados |
| `editor` | criar/editar/excluir lançamentos, categorias, contas e caixinhas |
| `leitor` | apenas ver e exportar |

### 4.3 `Categorias`

| Coluna | Tipo | Observação |
|---|---|---|
| `ID` | texto | id interno |
| `Nome` | texto | **único** no conjunto |
| `Tipo` | texto | `Despesa` \| `Receita` |
| `Grupo` | texto | Moradia, Alimentação, Transporte… (livre) |
| `Cor` | texto | hexadecimal, ex.: `#22c55e` |
| `OrcamentoMensal` | moeda | orçamento do mês (0 = sem orçamento) |
| `Ativo` | texto | `SIM` \| `NAO` |
| `Obs` | texto | livre |
| `CriadoEm` | data/hora | automático |

### 4.4 `Contas`

| Coluna | Tipo | Observação |
|---|---|---|
| `ID` | texto | id interno |
| `Nome` | texto | **único** |
| `Tipo` | texto | `Conta Corrente` \| `Poupança` \| `Cartão de Crédito` \| `Carteira` \| `Investimento` \| `Outro` |
| `Instituicao` | texto | Nubank, Itaú, Bradesco… |
| `Limite` | moeda | limite do cartão (0 = sem limite) |
| `DiaVencimento` | número | dia do vencimento da fatura (1–31) |
| `Cor` | texto | hexadecimal |
| `Ativo` | texto | `SIM` \| `NAO` |
| `Obs` | texto | livre |
| `CriadoEm` | data/hora | automático |

### 4.5 `Lancamentos` — a tabela principal

| # | Coluna | Tipo | Significado |
|---|---|---|---|
| 1 | `ID` | texto | id único do lançamento |
| 2 | `Data` | data | **data de competência** (quando o dinheiro entra/sai) |
| 3 | `Tipo` | texto | `Despesa` \| `Receita` |
| 4 | `Valor` | moeda | **sempre positivo**; o `Tipo` define o sinal |
| 5 | `Descricao` | texto | "Aluguel de outubro" |
| 6 | `CategoriaID` | texto | id da categoria (aba `Categorias`) |
| 7 | `ContaID` | texto | id da conta (aba `Contas`) |
| 8 | `FormaPagamento` | texto | `Débito` \| `Crédito` \| `Pix` \| `Dinheiro` \| `Boleto` \| `Transferência` \| `Outro` |
| 9 | `Parcelas` | número | total de parcelas (1 = à vista) |
| 10 | `ParcelaAtual` | número | qual parcela é esta (1..N) |
| 11 | `Status` | texto | `Pago` \| `Pendente` \| `Aguardando` \| `Cancelado` |
| 12 | `Recorrente` | texto | `SIM` = se repete todo mês (entra na projeção) |
| 13 | `Fixo` | texto | `SIM` = gasto fixo mensal |
| 14 | `Competencia` | texto | `AAAA-MM` derivado da data (texto puro, **não** data) |
| 15 | `CaixinhaID` | texto | vincula a uma caixinha (opcional) |
| 16 | `GrupoParcelas` | texto | id que amarra as parcelas de uma compra |
| 17 | `Obs` | texto | observações |
| 18 | `CriadoEm` | data/hora | automático |
| 19 | `AtualizadoEm` | data/hora | automático |
| 20 | `CriadoPor` | texto | e-mail de quem criou |

**Regras de ouro**

- `Valor` **sempre positivo**. Um gasto de 1.500 é `1500` + `Tipo=Despesa`.
  Assim a coluna pode ser somada e filtrada sem pensar em sinal.
- `Competencia` é preenchida pelo app a partir da `Data`. É o que permite
  agrupar por mês em relatórios e no painel.
- `Recorrente=SIM` cria um "modelo": o app projeta esse valor em todos os meses
  seguintes. Ex.: cadastrar o aluguel **uma vez** em janeiro e o painel já
  mostra o aluguel previsto de fevereiro em diante.
- `Fixo=SIM` marca os gastos que não mudam (aluguel, streaming, academia).
- `Parcelas > 1` → o app cria **N linhas** com `GrupoParcelas` igual e datas
  mês a mês. Editar ou excluir uma parcela oferece apagar o grupo inteiro.

### 4.6 `Caixinhas`

| Coluna | Tipo | Observação |
|---|---|---|
| `ID` | texto | id interno |
| `Nome` | texto | "Reserva de Emergência" |
| `Descricao` | texto | objetivo |
| `Meta` | moeda | valor alvo |
| `Prazo` | texto | `AAAA-MM` — até quando quer chegar lá |
| `SaldoInicial` | moeda | quanto já tinha antes de usar o app |
| `Cor` | texto | hexadecimal |
| `Ativo` | texto | `SIM` \| `NAO` |
| `CriadoEm` | data/hora | automático |
| `CriadoPor` | texto | automático |

### 4.7 `Movimentacoes`

| Coluna | Tipo | Observação |
|---|---|---|
| `ID` | texto | id interno |
| `CaixinhaID` | texto | id da caixinha |
| `Data` | data | data do aporte/resgate |
| `Tipo` | texto | `Entrada` \| `Saida` |
| `Valor` | moeda | positivo |
| `Descricao` | texto | "Aporte mensal" |
| `Origem` | texto | `Manual` \| `Lancamento` |
| `LancamentoID` | texto | id do lançamento de origem (se houver) |
| `CriadoEm` | data/hora | automático |
| `CriadoPor` | texto | automático |

> **Como a caixinha calcula o saldo**
> `Saldo = SaldoInicial + Σ Entradas − Σ Saídas`
> A movimentação da caixinha é a fonte de verdade. Vincular um `Lancamento` a
> uma caixinha é apenas uma referência (não soma duas vezes).

### 4.8 `Sessoes`

| Coluna | Tipo | Observação |
|---|---|---|
| `ID` | texto | id interno |
| `Token` | texto | token do login |
| `UsuarioID` | texto | id do usuário |
| `Email` | texto | e-mail do usuário |
| `CriadoEm` | data/hora | automático |
| `ExpiraEm` | data/hora | validade (30 dias) |
| `Ativo` | texto | `SIM` \| `NAO` |

> Para **encerrar todas as sessões** (ex.: senha vazada), use o menu
> **Financeiro → Revogar todas as sessões** ou apague as linhas.

### 4.9 `Log` (auditoria)

| Coluna | Tipo |
|---|---|
| `ID` | texto |
| `Timestamp` | data/hora |
| `UsuarioID` | texto |
| `Email` | texto |
| `Acao` | texto (`criar`, `editar`, `excluir`, `login`…) |
| `Entidade` | texto (`Lancamentos`, `Acessos`…) |
| `EntidadeID` | texto |
| `Detalhes` | texto |

---

## 5. Se preferir criar as abas na mão

Se **não** quiser usar o `Setup.gs`, crie as abas com ** exatamente estes
cabeçalhos na linha 1** (nomes com acento, maiúsculas e minúsculas exatamente
como aqui — o app casa o nome da coluna, não a posição):

| Aba | Cabeçalho (linha 1) |
|---|---|
| `Config` | `ID` · `Chave` · `Valor` · `Descricao` |
| `Acessos` | `ID` · `Nome` · `Email` · `Perfil` · `Ativo` · `Salt` · `SenhaHash` · `CriadoEm` · `UltimoAcesso` · `Obs` |
| `Categorias` | `ID` · `Nome` · `Tipo` · `Grupo` · `Cor` · `OrcamentoMensal` · `Ativo` · `Obs` · `CriadoEm` |
| `Contas` | `ID` · `Nome` · `Tipo` · `Instituicao` · `Limite` · `DiaVencimento` · `Cor` · `Ativo` · `Obs` · `CriadoEm` |
| `Lancamentos` | `ID` · `Data` · `Tipo` · `Valor` · `Descricao` · `CategoriaID` · `ContaID` · `FormaPagamento` · `Parcelas` · `ParcelaAtual` · `Status` · `Recorrente` · `Fixo` · `Competencia` · `CaixinhaID` · `GrupoParcelas` · `Obs` · `CriadoEm` · `AtualizadoEm` · `CriadoPor` |
| `Caixinhas` | `ID` · `Nome` · `Descricao` · `Meta` · `Prazo` · `SaldoInicial` · `Cor` · `Ativo` · `CriadoEm` · `CriadoPor` |
| `Movimentacoes` | `ID` · `CaixinhaID` · `Data` · `Tipo` · `Valor` · `Descricao` · `Origem` · `LancamentoID` · `CriadoEm` · `CriadoPor` |
| `Sessoes` | `ID` · `Token` · `UsuarioID` · `Email` · `CriadoEm` · `ExpiraEm` · `Ativo` |
| `Log` | `ID` · `Timestamp` · `UsuarioID` · `Email` · `Acao` · `Entidade` · `EntidadeID` · `Detalhes` |

Depois rode **Financeiro → 3. Configurar planilha** de novo: ele completa
cabeçalhos faltantes, aplica formatação e validações **sem apagar seus dados**.

### Formatação recomendada

| Coluna | Formatação do Sheets |
|---|---|
| `Data` | `dd/mm/yyyy` |
| `CriadoEm`, `AtualizadoEm`, `Timestamp`, `ExpiraEm`, `UltimoAcesso` | `dd/mm/yyyy hh:mm` |
| `Valor`, `Meta`, `Limite`, `SaldoInicial`, `OrcamentoMensal` | `#,##0.00` |
| `Competencia`, `Prazo` | **Texto puro** (`@`) — senão o Sheets converte em data |
| Linha 1 de todas as abas |Negrito, fundo escuro, **fixar linha 1** |

---

## 6. O que **não** fazer na planilha

Para o app continuar funcionando:

1. **Não renomeie abas** (`Lancamentos`, `Acessos`…) nem colunas — o app busca
   pelo nome do cabeçalho.
2. **Não use células mescladas** nas abas de dados.
3. **Não digite nada nas colunas `ID`** — o app gera UUIDs. Se precisar, use
   valores únicos e estáveis.
4. **Não apague as linhas 1 (cabeçalho)**.
5. **Não deixe `Valor` negativo** — o sinal vem do `Tipo`.
6. **Não mexa em `Competencia`** manualmente; ela é recalculada a cada gravação.
7. Não edite `SenhaHash`/`Salt` manualmente (use o menu *Gerar hash de senha*).

---

## 7. Escala e performance

| Volume | Comportamento |
|---|---|
| até 5 mil lançamentos |tranquilo, leitura em 1 request |
| 5 mil – 50 mil | funciona, leitura em ~2–5 s |
| acima de 50 mil | considere particionar por ano (aba `Lancamentos_2025`) |

O app lê a planilha inteira em uma chamada (`bootstrap`). Se um dia ficar
lento, a solução é filtrar por ano no backend e adicionar um parâmetro
`ano` na ação `bootstrap` — o front já sabe filtrar por competência.

**Dicas para manter a planilha leve:**
- apague lançamentos antigos que nãoPrecisa (o app também faz isso);
- evite colunas extras com fórmulas pesadas na aba `Lancamentos`;
- use `Log` com limpeza periódica (a aba só cresce).

---

## 8. Backup

- **Histórico de versões do Sheets**: *Arquivo → Histórico de versões* →
  restaura qualquer estado. Ative o compartilhamento com você mesmo.
- **Backup do app**: `File → Make a copy` da planilha, uma vez por mês.
- **Backup do código**: o repositório GitHub guarda o app; o script fica no
  Apps Script (faça uma cópia do `Code.gs` no repositório, como já está).

---

## 9. Checklist antes de abrir o app para a família

- [ ] Abas criadas com os nomes certos
- [ ] Formatação de data e moeda aplicada
- [ ] Linha 1 fixada em todas as abas
- [ ] Administrador criado (pelo app, pelo menu ou pela tela de login)
- [ ] Categorias e contas reais (não só as padrão)
- [ ] `Config` com `simbolo_moeda` e `nome_app` do jeito que você quer
- [ ] URL do Web App publicada e colada no app
- [ ] Primeiro usuário de teste criado com perfil `leitor` para conferir as permissões

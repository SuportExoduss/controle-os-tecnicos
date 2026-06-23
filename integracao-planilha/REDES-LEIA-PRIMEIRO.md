# Integração da Equipe de REDES com a planilha (Google Sheets)

A integração de Redes usa **o mesmo Web App e o mesmo token** já configurados para a
Fibra. A única coisa que falta é **atualizar o código do Apps Script** com a versão
nova do `Codigo.gs` (que agora também trata a aba **"Lancamentos Redes"**).

## Passo único (fazer 1 vez)

1. Abra a planilha **"Planilha Padrão Operacional IbiúNET 2026 - TMN"** no Google Sheets.
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo do arquivo `Codigo.gs` e cole o conteúdo **completo** do
   arquivo `integracao-planilha/Codigo.gs` deste projeto (versão atualizada).
4. Clique em **Implantar → Gerenciar implantações** → edite a implantação existente
   (a mesma do site) → **Nova versão** → **Implantar**.
   *(Não precisa criar um Web App novo nem trocar a URL — é a mesma do site.)*
5. Pronto. A partir daí, tudo que for registrado/editado/fechado/importado/excluído
   em `/redes/admin` é gravado automaticamente na aba **"Lancamentos Redes"**.

## O que o site envia para a aba "Lancamentos Redes"

Mapeado pelo NOME do cabeçalho (tolerante a acento/maiúsculas):

| Coluna na planilha | De onde vem |
|---|---|
| DATA | Data de registro (encerramento, p/ importados) |
| ID OS | ID da O.S (chave única — evita duplicar) |
| TECNICO RESPONSAVEL | Técnico |
| ASSUNTO | Assunto |
| TRANSMISSOR | Transmissor/OLT |
| DATA ABERTURA | Data + horário de abertura |
| DATA FECHAMENTO | Data + horário de encerramento |
| SLA MÉDIO | SLA em dias (horas ÷ 24) |
| SLA SEGUNDOS | SLA em segundos (horas × 3600) |
| SLA | SLA em horas |
| OBSERVAÇÃO | Observação |

- **Chave de deduplicação:** `ID OS`. Salvar a mesma O.S substitui a linha (não duplica).
- **Excluir** no site remove a linha correspondente na planilha.
- É **best-effort**: se a planilha falhar, o salvamento no Firestore continua normal.

## Sobre as datas (contabilização no dashboard)

- As O.S **importadas** são contabilizadas no dashboard pela **data de encerramento**
  (ou de abertura, se ainda abertas) — como se o relatório tivesse sido feito no dia
  do encerramento. Isso já está ativo (sem precisar mexer em nada).
- As O.S **lançadas manualmente** continuam sendo contabilizadas pela **data em que
  foram inseridas** (data de registro).

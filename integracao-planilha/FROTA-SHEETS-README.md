# Integração FROTA → Google Sheets (dormente)

Pronta para ligar. Hoje está **desligada** — o site não envia nada até a URL ser configurada.

## Arquivos
- `frota-checklist.gs` — Apps Script (cola na planilha/projeto Apps Script e implanta como App da Web).
- `frota-sheets-sync.js` — cliente (importado pelo app quando o fluxo Firestore estiver pronto).

## Como liga (quando aprovado)
1. **Template**: crie um Google Sheets com o layout **idêntico** à aba `RELATORIO CHECKLIST Junho 2026`
   (mesmos cabeçalhos: `Colaborador`, `01/06`…`30/06`, `CHECK LIST PADRÃO`, `NÃO FEZ`, `ATRASADO`, `AUSENTE`…). Copie o **ID**.
2. **Pasta**: escolha a pasta do Drive onde nascem os arquivos mensais. Copie o **ID**.
3. Em `frota-checklist.gs`, preencha `SECRET`, `TEMPLATE_ID`, `FOLDER_ID`.
4. No editor Apps Script: **Implantar → Nova implantação → App da Web** (executar como você, acesso "qualquer pessoa"). Copie a URL.
5. No `.env` do site:
   ```
   VITE_FROTA_SHEETS_URL=<a URL do App da Web>
   VITE_FROTA_SHEETS_SECRET=<o mesmo SECRET>
   ```
   Pronto — `frotaSheetsEnabled()` passa a `true` e o botão "Enviar para o Google Sheets" liga.

## O que é gravado (e o que NÃO é)
- **Grava**: a célula de cada dia (`placa` / `placa-ATRASADO` / `NAO FEZ` / `AUSENTE` / troca) + as 4 colunas-resumo por fórmula CONT.SE.
- **NÃO grava**: CPF (LGPD) nem a "origem" (manual/importado) — isso fica só no app.

## Arquivo novo por mês
O Apps Script cria `RELATORIO CHECKLIST <Mês> <Ano>` copiando o template **só se ainda não existir**.
Reenvios do mesmo mês **atualizam** o arquivo existente (idempotente).

## Contrato do payload
```json
{
  "secret": "…",
  "mes": "Junho", "ano": "2026",
  "linhas": [
    { "nome": "Andre Luiz Roberth Pereira de Barros",
      "dias": { "1": "TIV1I01", "5": "TIV1I01-ATRASADO", "9": "NAO FEZ", "21": "AUSENTE" } }
  ]
}
```

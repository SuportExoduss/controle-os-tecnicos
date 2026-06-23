# Integração da Equipe de CÂMERAS (WIBICAM) com a planilha (Google Sheets)

A integração de Câmeras usa **o mesmo Web App e o mesmo token** já configurados para a
Fibra e a Redes. A única coisa que falta é **atualizar o código do Apps Script** com a
versão nova do `Codigo.gs` (que agora também trata a aba **"Lancamentos Equipe Cameras"**).

## Passo único (fazer 1 vez)

1. Abra a planilha **"Planilha Padrão Operacional IbiúNET 2026 - TMN"** no Google Sheets.
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo do arquivo `Codigo.gs` e cole o conteúdo **completo** do
   arquivo `integracao-planilha/Codigo.gs` deste projeto (versão atualizada).
4. (Opcional, recomendado) No editor do Apps Script, selecione a função
   **`debugHeadersCameras`** e clique em **Executar** — veja em *Execuções/Logs* se
   `date` e `tecnico` ficaram `>= 0`. Se algum tipo ficar `-1`, o cabeçalho da coluna
   na planilha está diferente do esperado (ajuste o nome da coluna ou o alias no script).
5. Clique em **Implantar → Gerenciar implantações** → edite a implantação existente
   (a mesma do site) → **Nova versão** → **Implantar**.
   *(Não precisa criar um Web App novo nem trocar a URL — é a mesma do site.)*
6. Pronto. A partir daí, tudo que for registrado/editado/importado em `/cameras/admin`
   é gravado automaticamente na aba **"Lancamentos Equipe Cameras"**.

> Se a aba tiver outro nome no Google Sheets, ajuste a constante
> `CAMERAS_SHEET_NAME` no topo da seção de Câmeras do `Codigo.gs`.

## O que o site envia para a aba "Lancamentos Equipe Cameras"

Mapeado pelo NOME do cabeçalho (tolerante a acento/maiúsculas):

| Coluna na planilha | De onde vem |
|---|---|
| Data | Data de registro |
| Tecnico | Técnico |
| instalação Wi-bicam | Contagem do tipo de serviço |
| Reparo | Contagem do tipo de serviço |
| Troca de Roteador/Vistoria Fibra/Reparo TV | Contagem do tipo de serviço |
| Mudança de endereço c/wi-bicam | Contagem do tipo de serviço |
| Mudança de ponto C/Wi-bicam | Contagem do tipo de serviço |
| Vistoria técnica wi-bicam | Contagem do tipo de serviço |
| Retirada | Contagem do tipo de serviço |
| KM Rodado | KM do fim − KM do início do dia |
| Reagendamentos | Reagendamentos |
| Pontos Instalados | Câmeras instaladas no dia |
| Pontos Cancelados | Câmeras canceladas no dia |
| Total OS | Soma dos tipos de serviço |
| Observações | Observação |

- **Chave de deduplicação:** `Data` + `Tecnico`. Salvar o mesmo técnico no mesmo dia
  substitui a linha (não duplica) — igual à Fibra.
- **Apagar dia/colaborador** no site **zera** as linhas correspondentes na planilha
  (mantém a linha para refazer).
- É **best-effort**: se a planilha falhar, o salvamento no Firestore continua normal.

> As colunas **BASE ATIVAS** e **TOTAL CÂMERAS ATIVAS** da planilha **não** são tocadas
> pelo script — continuam sendo preenchidas manualmente como hoje.

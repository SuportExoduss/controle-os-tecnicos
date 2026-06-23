# Ativar a integração com a planilha do Google

Você faz isso UMA vez. Leva uns 3 minutos.

## 1. Abrir o editor de script
1. Abra a **planilha do Google** (a que a diretoria usa).
2. No menu, clique em **Extensões → Apps Script**.
3. Vai abrir uma aba nova com um editor de código.

## 2. Colar o código
1. Apague tudo que estiver no editor (o `function myFunction() {}`).
2. Cole **todo** o conteúdo do arquivo **`Codigo.gs`** (está nesta mesma pasta).
3. Clique no ícone de **salvar** (disquete) ou Ctrl+S.

## 3. (Só se precisar) Definir a aba
- Se os lançamentos **não** ficam na **primeira aba** da planilha, edite a linha:
  `var SHEET_NAME = '';`
  e coloque o nome exato da aba entre as aspas. Ex: `var SHEET_NAME = 'Lançamentos';`

## 4. Conferir o mapeamento das colunas
1. No topo do editor, no seletor de função, escolha **`debugHeaders`**.
2. Clique em **▶ Executar**.
3. Vai pedir para **autorizar** → clique em **Revisar permissões** → escolha sua conta → **Avançado → Acessar (não seguro)** → **Permitir**. (É seguro, é o seu próprio script.)
4. Embaixo, em **Registro de execução**, veja se os cabeçalhos foram detectados. Manda um print disso pro Claude conferir o mapeamento.

## 5. Publicar como App da Web
1. No canto superior direito, clique em **Implantar → Nova implantação**.
2. No ícone de engrenagem, escolha o tipo **App da Web**.
3. Configure:
   - **Executar como:** Eu (seu e-mail)
   - **Quem tem acesso:** Qualquer pessoa
4. Clique em **Implantar** e **autorize** de novo se pedir.
5. Vai aparecer uma **URL do app da Web** que termina em **`/exec`**.
6. **Copie essa URL e mande pro Claude.**

## 6. Pronto
O Claude cola a URL no site, publica, e a partir daí **todo relatório salvo vai pra planilha automaticamente** (criando ou atualizando a linha do técnico+data).

> Se um dia você mudar o código do script, precisa **Implantar → Gerenciar implantações → editar → Nova versão**. A URL continua a mesma.

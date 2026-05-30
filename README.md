# 📊 Sistema de Controle Diário de O.S - IBIUNET

Sistema web profissional para controle diário de produtividade dos técnicos. Registra O.S finalizadas, reagendamentos, classificação de serviços e gera relatórios em PDF.

## ✨ Funcionalidades

- ✅ **Autenticação** - Login seguro com Firebase Authentication
- ✅ **Registro de O.S** - Formulário intuitivo para registrar ordens de serviço
- ✅ **Sistema de Wizard** - Classificação automática de tipos de serviço
- ✅ **Dashboard** - Visualização consolidada de relatórios por data e técnico
- ✅ **Filtros Avançados** - Busca por data e nome do técnico
- ✅ **Relatórios em PDF** - Geração de PDF individual e geral
- ✅ **Histórico Completo** - Acesso a todos os registros anteriores
- ✅ **Resumo Executivo** - Total de O.S, técnicos, reagendamentos e serviço mais executado
- ✅ **Tema Responsivo** - Interface otimizada para desktop e mobile
- ✅ **100% Gratuito** - Hospedado em Firebase Hosting

## 🛠️ Stack Tecnológico

**Frontend:**
- React 18
- Vite
- TailwindCSS
- React Router DOM
- Framer Motion
- React Hook Form
- React Hot Toast
- Lucide React

**Backend & Database:**
- Firebase Authentication
- Firestore Database
- Firebase Hosting

**Ferramentas:**
- jsPDF - Geração de PDF
- html2canvas - Captura de elementos

## 📦 Instalação

### Pré-requisitos
- Node.js v18+
- npm ou yarn
- Conta GitHub
- Conta Firebase

### Passos

1. **Clone o repositório**
```bash
git clone https://github.com/SuportExoduss/controle-os-tecnicos.git
cd controle-os-tecnicos
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Crie um arquivo `.env` na raiz do projeto com suas credenciais Firebase:

```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto_id
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

4. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

## 🚀 Deploy no Firebase Hosting

1. **Instale Firebase CLI (se não tiver)**
```bash
npm install -g firebase-tools
```

2. **Faça login no Firebase**
```bash
firebase login
```

3. **Inicialize Firebase no projeto**
```bash
firebase init
```

Escolha:
- ✅ Hosting
- Selecione seu projeto
- Pasta de distribuição: `dist`
- Single Page App: `Yes`

4. **Build do projeto**
```bash
npm run build
```

5. **Deploy para Firebase**
```bash
firebase deploy
```

Seu projeto estará disponível em: `https://seu-projeto.web.app`

## 📝 Uso

### 1. Login
- Email: `admin@empresa.com`
- Senha: `123456`

### 2. Registrar O.S
1. Acesse a página de administração
2. Preencha o formulário com:
   - Nome do técnico
   - Quantidade de O.S
   - Se houve reagendamento
   - Observações (opcional)
3. Sistema abrirá wizard para classificar cada O.S
4. Confirme e salve

### 3. Visualizar Relatórios
1. Acesse o Dashboard (público)
2. Filtre por data e/ou técnico
3. Expanda o card de cada técnico para ver detalhes
4. Gere PDF individual ou texto

## 📊 Estrutura de Dados

### Coleção: `daily_reports`
```json
{
  "id": "documento_id",
  "date": "2026-05-30",
  "technicianName": "João Silva",
  "totalOrders": 5,
  "rescheduled": true,
  "rescheduledCount": 2,
  "observations": "Cliente solicitou reagendamento",
  "serviceTypes": ["INSTALAÇÃO", "VISTORIA"],
  "submissionTime": "14:30:45",
  "createdAt": "2026-05-30T14:30:45.000Z"
}
```

## 🔐 Segurança

- ✅ Autenticação Firebase obrigatória para registro
- ✅ Dashboard público apenas leitura
- ✅ Dados criptografados no Firestore
- ✅ Regras de segurança configuradas

## 🎨 Tema

- **Cor Primária:** Azul (#0066CC)
- **Cor Secundária:** Cinza (#ADADAD)
- **Fundo:** Branco e Cinza claro
- **Tipografia:** System Fonts (máxima compatibilidade)

## 📱 Responsividade

- ✅ Desktop (1920px+)
- ✅ Tablet (768px - 1919px)
- ✅ Mobile (320px - 767px)

## 🧪 Testes

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview de produção
npm run preview
```

## 📄 Licença

Todos os direitos reservados © 2026 IBIUNET

## 👨‍💻 Desenvolvedor

Desenvolvido com ❤️ por SuportExoduss

## 📞 Suporte

Para reportar issues ou sugerir melhorias, abra uma issue no GitHub.

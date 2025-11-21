# Sistema de Lista de Compras com Microsserviços e Mensageria

Sistema distribuído para gerenciamento de listas de compras utilizando arquitetura de microsserviços com API Gateway, Service Discovery, bancos NoSQL independentes e **mensageria assíncrona com RabbitMQ**.

**Desenvolvido para:** Laboratório de Desenvolvimento de Aplicações Móveis e Distribuídas - PUC Minas  
**Aluno:** Vinicius Xavier

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Quick Start](#-quick-start)
- [Mensageria RabbitMQ](#-mensageria-rabbitmq-novo)
- [Arquitetura](#-arquitetura)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Funcionalidades](#-funcionalidades-por-serviço)
- [Principais Endpoints](#-principais-endpoints)
- [Screenshots](#-screenshots)
- [Testando o Sistema](#-testando-o-sistema)
- [Troubleshooting](#-troubleshooting)
- [Tecnologias](#-tecnologias-utilizadas)
- [Requisitos Atendidos](#-requisitos-atendidos)

---

## 📋 Visão Geral

Este projeto implementa um **sistema completo de microsserviços** para gerenciamento de listas de compras, com:

### Serviços Implementados

- **User Service** (porta 3001) - Autenticação e gerenciamento de usuários
- **Item Service** (porta 3002) - Catálogo de produtos (23 itens pré-cadastrados)
- **List Service** (porta 3003) - Gerenciamento de listas de compras
- **API Gateway** (porta 3000) - Ponto único de entrada com roteamento inteligente

### Consumers (Mensageria)

- **Notification Service** - Processa eventos de checkout e envia notificações
- **Analytics Service** - Calcula estatísticas e atualiza dashboard em tempo real

### Componentes Principais

- ✅ **Autenticação JWT** com hash bcrypt
- ✅ **Service Discovery** baseado em arquivo
- ✅ **Circuit Breaker** (3 falhas = circuito aberto)
- ✅ **Health Checks** automáticos (a cada 30 segundos)
- ✅ **Banco NoSQL** (JSON file-based)
- ✅ **Dashboard Agregado** com estatísticas
- ✅ **Busca Global** (itens + listas)
- ✅ **🐇 Mensageria Assíncrona** com RabbitMQ (CloudAMQP)

---

## 🚀 Quick Start

### 1. Instalação

```bash
# Instalar dependências do root
npm install

# Instalar dependências de todos os serviços
npm run install:all
```

### 2. Executar

**Opção 1: Um Único Comando** (⚡ Recomendado)

```bash
npm start
```

Este comando inicia **automaticamente todos os 4 serviços** em paralelo com saída colorida.

**Opção 2: Serviços Individuais** (4 terminais diferentes)

```bash
# Terminal 1
npm run start:user

# Terminal 2
npm run start:item

# Terminal 3
npm run start:list

# Terminal 4
npm run start:gateway
```

### 3. Testar

```bash
# Executar demonstração completa (original)
npm run demo

# Ou verificar health
curl http://localhost:3000/health
```

---

## 🐇 Mensageria RabbitMQ (NOVO)

### Pré-requisito

1. Configure CloudAMQP com exchange `shopping_events` (tipo topic), filas `notification_queue` e `analytics_queue`, e bindings com routing key `list.checkout.#`
2. Cole a URL do CloudAMQP no arquivo `.env` na raiz do projeto:

```env
RABBITMQ_URL=amqps://usuario:senha@hostname/vhost
```

### 🚀 Ordem de Execução

```bash
# Terminal 1 - Serviços
npm start

# Terminal 2 - Consumers (aguarde Terminal 1 estar pronto)
npm run start:consumers

# Terminal 3 - Demo de Checkout
npm run demo:checkout
```

### 🎯 Fluxo de Checkout Assíncrono

1. **Cliente** → `POST /api/lists/:id/checkout`
2. **List Service** publica mensagem no RabbitMQ
3. **API retorna 202 Accepted** (~50ms)
4. **Consumers processam em background:**
   - 📧 Notification Service → Simula envio de email
   - 📊 Analytics Service → Atualiza estatísticas

### 📊 O que Observar na Demonstração

✅ **Resposta rápida**: API retorna 202 em < 100ms  
✅ **Processamento assíncrono**: Consumers trabalham em background  
✅ **RabbitMQ Management**: Gráficos de mensagens publicadas/consumidas  
✅ **Logs dos Consumers**: Mensagens processadas instantaneamente

---

## 🏗️ Arquitetura

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                              │
│                  (client-demo.js / Browser)                 │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP Requests
                            ▼
┌────────────────────────────────────────────────────────────┐
│                  API GATEWAY (Porta 3000)                  │
│                                                            │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │  Roteamento  │  │Circuit Breaker│  │Service Discovery│  │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
│                                                            │
│  Rotas:                                                    │
│  • /api/auth/*    → User Service                           │
│  • /api/users/*   → User Service                           │
│  • /api/items/*   → Item Service                           │
│  • /api/lists/*   → List Service                           │
│  • /api/dashboard → Agregado (User + List)                 │
│  • /api/search    → Agregado (Item + List)                 │
│  • /health        → Status de todos os serviços            │ 
│  • /registry      → Service Registry                       │
└───────┬──────────────────┬────────────────┬────────────────┘
        │                  │                │
        ▼                  ▼                ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│USER SERVICE │    │ITEM SERVICE │    │LIST SERVICE │
│  (3001)     │    │  (3002)     │    │  (3003)     │
│             │    │             │    │             │
│ • Auth/JWT  │    │ • Catálogo  │    │ • Listas    │
│ • bcrypt    │    │ • 23 itens  │    │ • Items     │
│ • CRUD      │    │ • Categorias│    │ • Summary   │
│             │    │             │    │ • Checkout  ──┐
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘ │
       │                  │                  │        │
       ▼                  ▼                  ▼        │ Publish
┌────────────┐     ┌────────────┐     ┌────────────┐  │ Event
│users.json  │     │items.json  │     │lists.json  │  |
└────────────┘     └────────────┘     └────────────┘  │
                                                      │
            ┌─────────────────────────────────────────┘
            │
            ▼
    ┌────────────────┐
    │   RabbitMQ     │
    │  CloudAMQP     │
    │                │
    │ shopping_events│ (Topic Exchange)
    │                │
    └────┬───────┬───┘
         │       │
    ┌────┘       └────┐
    ▼                 ▼
┌─────────────┐   ┌────────────┐
│ Notification│   │ Analytics  │
│  Consumer   │   │  Consumer  │
│             │   │            │
│• Email      │   │• Stats     │
│• SMS        │   │• Dashboard │
└─────────────┘   └────────────┘
```

### Características Principais

- **Autenticação**: JWT com hash bcrypt, tokens de 24h
- **Circuit Breaker**: 3 falhas consecutivas = circuito aberto por 60s
- **Health Checks**: Automáticos a cada 30 segundos
- **Service Discovery**: Registro dinâmico de serviços

---

## 📁 Estrutura do Projeto

```
lista-compras-mensageria/
├── package.json              # Scripts principais
├── client-demo.js            # Cliente de demonstração original
├── demo-checkout.js          # Demo de checkout com mensageria
├── start-all.ps1             # Script PowerShell
├── .env                      # Variáveis de ambiente (CloudAMQP URL)
│
├── shared/                   # Código compartilhado
│   ├── JsonDatabase.js       # Banco NoSQL em JSON
│   ├── serviceRegistry.js    # Service Discovery
│   └── rabbitmq.js           # RabbitMQ Manager (conexão, publish, consume)
│
├── consumers/                # Serviços de mensageria
│   ├── notification-service.js  # Processa notificações de checkout
│   └── analytics-service.js     # Processa analytics de checkout
│
├── services/
│   ├── user-service/         # Porta 3001
│   │   ├── package.json
│   │   └── server.js
│   ├── item-service/         # Porta 3002
│   │   ├── package.json
│   │   └── server.js
│   └── list-service/         # Porta 3003
│       ├── package.json
│       └── server.js         # Inclui endpoint /checkout
│
├── api-gateway/              # Porta 3000
│   ├── package.json
│   └── server.js
│
└── data/                     # Criado automaticamente
    ├── users.json
    ├── items.json
    ├── lists.json
    └── service-registry.json
```

---

## 🎯 Funcionalidades por Serviço

### User Service (Porta 3001)
- Registro e autenticação com JWT
- Hash de senhas com bcrypt
- Gerenciamento de perfil

### Item Service (Porta 3002)
- Catálogo com 23 itens em 5 categorias (Alimentos, Limpeza, Higiene, Bebidas, Padaria)
- Busca e filtros por categoria/nome

### List Service (Porta 3003)
- CRUD de listas de compras
- Adicionar/remover/atualizar itens
- Cálculo automático de totais e estatísticas
- Checkout assíncrono com mensageria RabbitMQ

### API Gateway (Porta 3000)
- Proxy para todos os serviços
- Circuit Breaker (3 falhas = 60s timeout)
- Dashboard agregado e busca global
- Health checks de todos os serviços

---

## 📡 Principais Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar usuário
- `POST /api/auth/login` - Login (retorna JWT)

### Itens
- `GET /api/items` - Listar itens (filtros: ?category=X, ?name=X)
- `GET /api/categories` - Listar categorias

### Listas  
- `POST /api/lists` - Criar lista
- `GET /api/lists` - Minhas listas
- `POST /api/lists/:id/items` - Adicionar item
- `POST /api/lists/:id/checkout` - Finalizar compra (202 Accepted)

### Agregados
- `GET /api/dashboard` - Dashboard com estatísticas
- `GET /api/search?q=termo` - Busca global

### Monitoramento
- `GET /health` - Status dos serviços

---

## 📸 Screenshots

![SSRabbitMQ01](https://github.com/user-attachments/assets/163e9d28-bda9-494d-9060-93f2da6798a5)

![SSRabbitMQ02](https://github.com/user-attachments/assets/7edfdecc-2bd0-491f-9021-ad4b6b2cd890)

![SSRabbitMQ03](https://github.com/user-attachments/assets/18de67f7-77e3-4cda-b844-3903fe70031e)

---

## 🧪 Testando o Sistema

### Cliente de Demonstração

```bash
# Demonstração completa original
npm run demo

# Demonstração de Checkout com Mensageria
npm run demo:checkout
```

---

## 🐛 Troubleshooting

### Porta em Uso
```powershell
# Encerrar processo na porta 3000
Get-NetTCPConnection -LocalPort 3000 | 
  Select-Object -ExpandProperty OwningProcess | 
  ForEach-Object { Stop-Process -Id $_ -Force }
```

### Problemas com RabbitMQ

**Erro de conexão:**
1. Verifique se `.env` existe com `RABBITMQ_URL`
2. Confirme que instância CloudAMQP está ativa
3. URL deve começar com `amqps://`

**Consumers não recebem mensagens:**
1. Verifique logs: "✅ Conectado ao RabbitMQ"
2. Confirme bindings no CloudAMQP Management
3. Reinicie os consumers

---

## 📦 Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **JWT (jsonwebtoken)** - Autenticação
- **bcrypt** - Hash de senhas
- **axios** - Cliente HTTP
- **uuid** - Geração de IDs
- **concurrently** - Executar serviços em paralelo
- **amqplib** - Cliente RabbitMQ para mensageria assíncrona
- **dotenv** - Gerenciamento de variáveis de ambiente

### Infraestrutura
- **RabbitMQ (CloudAMQP)** - Message Broker para comunicação assíncrona
- **JSON File-Based Database** - Armazenamento NoSQL simples

### Padrões e Práticas
- ✅ **Microservices Architecture**
- ✅ **API Gateway Pattern**
- ✅ **Service Discovery**
- ✅ **Circuit Breaker Pattern**
- ✅ **Health Check Pattern**
- ✅ **JWT Authentication**
- ✅ **RESTful API Design**
- ✅ **Repository Pattern**
- ✅ **Middleware Pattern**
- ✅ **Error Handling**
- ✅ **Logging**
- ✅ **Data Validation**
- ✅ **Message-Driven Architecture** (RabbitMQ)
- ✅ **Event-Driven Processing** (Async checkout)
- ✅ **Publisher-Subscriber Pattern** (Topic exchange)

---

## 📊 Estatísticas do Projeto

- **Serviços**: 4 microsserviços independentes + 2 consumers de mensageria
- **Endpoints**: 30+ rotas REST
- **Consumers**: 2 serviços de processamento assíncrono (Notification, Analytics)
- **Linhas de código**: ~2.000
- **Itens no catálogo**: 23 produtos em 5 categorias
- **Tempo de resposta API**: 10-100ms (síncrono)
- **Tempo de resposta Checkout**: < 100ms (assíncrono com mensageria)
- **Taxa de sucesso**: 100% em testes
- **Mensagens processadas**: Em tempo real via RabbitMQ

---

## ✅ Requisitos Atendidos

### Parte 1: User Service ✅
- [x] Cadastro de usuário com validação
- [x] Login com JWT (expiração 24h)
- [x] Buscar e atualizar perfil
- [x] Hash de senhas com bcrypt
- [x] Validação de email/username único
- [x] Middleware de autenticação

### Parte 2: Item Service ✅
- [x] CRUD completo de itens
- [x] 23 itens em 5 categorias
- [x] Busca e filtros (categoria, nome)
- [x] Listagem de categorias
- [x] Endpoint de busca (`/search`)

### Parte 3: List Service ✅
- [x] CRUD completo de listas
- [x] Gerenciamento de itens (add/update/remove)
- [x] Cálculo automático de totais
- [x] Resumo da lista com estatísticas
- [x] Integração com Item Service
- [x] Validação de propriedade

### Parte 4: API Gateway ✅
- [x] Roteamento para todos os serviços
- [x] Circuit Breaker implementado
- [x] Health checks automáticos
- [x] Dashboard agregado
- [x] Busca global
- [x] Logs de requisições

### Parte 5: Service Registry ✅
- [x] Registro automático
- [x] Health checks periódicos (30s)
- [x] Arquivo compartilhado
- [x] Cleanup na saída
- [x] Descoberta dinâmica

### Mensageria RabbitMQ ✅ (NOVO)
- [x] Integração com CloudAMQP (Topic Exchange)
- [x] Producer no List Service (checkout assíncrono)
- [x] Notification Consumer e Analytics Consumer
- [x] HTTP 202 Accepted para processamento em background
- [x] Demo automatizado de checkout

---

## 📄 Licença

MIT License - Vinicius Xavier @ PUC Minas 2025

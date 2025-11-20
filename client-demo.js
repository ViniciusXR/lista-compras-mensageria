const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

// Configuração de cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const log = {
  title: (msg) => console.log(`\n${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}`),
  section: (msg) => console.log(`${colors.bright}${colors.cyan}>>> ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.yellow}ℹ ${msg}${colors.reset}`),
  data: (obj) => console.log(JSON.stringify(obj, null, 2))
};

let authToken = null;
let userId = null;
let listId = null;

// Função para aguardar
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Registro de usuário
async function registerUser() {
  log.title();
  log.section('1. REGISTRANDO NOVO USUÁRIO');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      email: 'joao.silva@email.com',
      username: 'joaosilva',
      password: 'senha123',
      firstName: 'João',
      lastName: 'Silva',
      preferences: {
        defaultStore: 'Supermercado ABC',
        currency: 'BRL'
      }
    });

    log.success('Usuário registrado com sucesso!');
    log.data(response.data);
    userId = response.data.user.id;
    
    await sleep(1000);
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error?.includes('já cadastrado')) {
      log.info('Usuário já existe, continuando para login...');
    } else {
      log.error('Erro ao registrar usuário:');
      log.data(error.response?.data || error.message);
    }
  }
}

// 2. Login
async function loginUser() {
  log.title();
  log.section('2. FAZENDO LOGIN');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'joao.silva@email.com',
      password: 'senha123'
    });

    authToken = response.data.token;
    userId = response.data.user.id;
    
    log.success('Login realizado com sucesso!');
    log.info(`Token: ${authToken.substring(0, 20)}...`);
    log.info(`User ID: ${userId}`);
    
    await sleep(1000);
  } catch (error) {
    log.error('Erro ao fazer login:');
    log.data(error.response?.data || error.message);
    throw error;
  }
}

// 3. Buscar itens no catálogo
async function searchItems() {
  log.title();
  log.section('3. BUSCANDO ITENS NO CATÁLOGO');
  
  try {
    // Buscar por categoria
    log.info('Buscando itens da categoria "Alimentos"...');
    const response1 = await axios.get(`${API_BASE_URL}/items?category=Alimentos`);
    log.success(`Encontrados ${response1.data.length} itens de alimentos`);
    log.data(response1.data.slice(0, 3).map(i => ({ name: i.name, price: i.averagePrice })));
    
    await sleep(500);
    
    // Buscar por nome
    log.info('Buscando por "arroz"...');
    const response2 = await axios.get(`${API_BASE_URL}/items/search?q=arroz`);
    log.success(`Encontrados ${response2.data.length} itens`);
    log.data(response2.data);
    
    await sleep(1000);
  } catch (error) {
    log.error('Erro ao buscar itens:');
    log.data(error.response?.data || error.message);
  }
}

// 4. Criar lista de compras
async function createShoppingList() {
  log.title();
  log.section('4. CRIANDO LISTA DE COMPRAS');
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/lists`,
      {
        name: 'Compras do Mês',
        description: 'Lista de compras para o mês de novembro'
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    listId = response.data.list.id;
    
    log.success('Lista criada com sucesso!');
    log.data(response.data.list);
    
    await sleep(1000);
  } catch (error) {
    log.error('Erro ao criar lista:');
    log.data(error.response?.data || error.message);
  }
}

// 5. Adicionar itens à lista
async function addItemsToList() {
  log.title();
  log.section('5. ADICIONANDO ITENS À LISTA');
  
  try {
    // Primeiro, buscar alguns itens para adicionar
    const itemsResponse = await axios.get(`${API_BASE_URL}/items`);
    const items = itemsResponse.data.slice(0, 5); // Pegar os primeiros 5 itens
    
    log.info(`Adicionando ${items.length} itens à lista...`);
    
    for (const item of items) {
      const response = await axios.post(
        `${API_BASE_URL}/lists/${listId}/items`,
        {
          itemId: item.id,
          quantity: Math.floor(Math.random() * 5) + 1, // Quantidade aleatória entre 1 e 5
          notes: `Item do catálogo: ${item.category}`
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      
      log.success(`Adicionado: ${item.name} (${response.data.list.items[response.data.list.items.length - 1].quantity} ${item.unit})`);
      await sleep(300);
    }
    
    // Mostrar lista atualizada
    const listResponse = await axios.get(
      `${API_BASE_URL}/lists/${listId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    log.info('Lista completa:');
    log.data({
      name: listResponse.data.name,
      totalItems: listResponse.data.summary.totalItems,
      estimatedTotal: `R$ ${listResponse.data.summary.estimatedTotal.toFixed(2)}`,
      items: listResponse.data.items.map(i => ({
        name: i.itemName,
        quantity: i.quantity,
        unit: i.unit,
        price: `R$ ${i.estimatedPrice.toFixed(2)}`
      }))
    });
    
    await sleep(1000);
  } catch (error) {
    log.error('Erro ao adicionar itens:');
    log.data(error.response?.data || error.message);
  }
}

// 6. Marcar alguns itens como comprados
async function markItemsAsPurchased() {
  log.title();
  log.section('6. MARCANDO ITENS COMO COMPRADOS');
  
  try {
    const listResponse = await axios.get(
      `${API_BASE_URL}/lists/${listId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    const itemsToMark = listResponse.data.items.slice(0, 3); // Marcar os 3 primeiros
    
    for (const item of itemsToMark) {
      await axios.put(
        `${API_BASE_URL}/lists/${listId}/items/${item.itemId}`,
        {
          purchased: true
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      
      log.success(`${item.itemName} marcado como comprado`);
      await sleep(300);
    }
    
    await sleep(1000);
  } catch (error) {
    log.error('Erro ao marcar itens:');
    log.data(error.response?.data || error.message);
  }
}

// 7. Visualizar dashboard
async function viewDashboard() {
  log.title();
  log.section('7. VISUALIZANDO DASHBOARD');
  
  try {
    const response = await axios.get(
      `${API_BASE_URL}/dashboard`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    log.success('Dashboard carregado!');
    log.data({
      user: response.data.user,
      statistics: {
        ...response.data.statistics,
        totalEstimated: `R$ ${response.data.statistics.totalEstimated.toFixed(2)}`,
        completionRate: `${response.data.statistics.completionRate}%`
      }
    });
    
    await sleep(1000);
  } catch (error) {
    log.error('Erro ao buscar dashboard:');
    log.data(error.response?.data || error.message);
  }
}

// 8. Busca global
async function globalSearch() {
  log.title();
  log.section('8. BUSCA GLOBAL');
  
  try {
    const response = await axios.get(
      `${API_BASE_URL}/search?q=arroz`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    log.success('Resultados da busca:');
    log.data({
      query: response.data.query,
      itemsFound: response.data.results.items.length,
      listsFound: response.data.results.lists.length,
      items: response.data.results.items.map(i => i.name),
      lists: response.data.results.lists.map(l => l.name)
    });
    
    await sleep(1000);
  } catch (error) {
    log.error('Erro na busca:');
    log.data(error.response?.data || error.message);
  }
}

// 9. Verificar health dos serviços
async function checkHealth() {
  log.title();
  log.section('9. VERIFICANDO HEALTH DOS SERVIÇOS');
  
  try {
    const response = await axios.get('http://localhost:3000/health');

    log.success('Status dos serviços:');
    log.data(response.data);
    
    await sleep(1000);
  } catch (error) {
    log.error('Erro ao verificar health:');
    log.data(error.response?.data || error.message);
  }
}

// Executar demonstração completa
async function runDemo() {
  console.log(`${colors.bright}${colors.green}
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║    DEMONSTRAÇÃO DO SISTEMA DE LISTA DE COMPRAS             ║
║    Sistema de Microsserviços                               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

  try {
    await registerUser();
    await loginUser();
    await searchItems();
    await createShoppingList();
    await addItemsToList();
    await markItemsAsPurchased();
    await viewDashboard();
    await globalSearch();
    await checkHealth();
    
    log.title();
    log.success('DEMONSTRAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log(`\n${colors.bright}${colors.green}Todas as funcionalidades foram testadas.${colors.reset}\n`);
    
  } catch (error) {
    log.title();
    log.error('ERRO DURANTE A DEMONSTRAÇÃO');
    log.info('Certifique-se de que todos os serviços estão rodando:');
    console.log('  - User Service (porta 3001)');
    console.log('  - Item Service (porta 3002)');
    console.log('  - List Service (porta 3003)');
    console.log('  - API Gateway (porta 3000)');
  }
}

// Verificar se serviços estão rodando antes de iniciar
async function checkServices() {
  try {
    await axios.get('http://localhost:3000/health', { timeout: 5000 });
    runDemo();
  } catch (error) {
    log.error('API Gateway não está respondendo em http://localhost:3000');
    log.info('Por favor, inicie todos os serviços antes de executar a demonstração.');
    process.exit(1);
  }
}

checkServices();

const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

let token = '';
let userId = '';
let listId = '';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runCheckoutDemo() {
  try {
    console.log('\n' + '='.repeat(60));
    log('🛒 DEMONSTRAÇÃO DE CHECKOUT COM MENSAGERIA', 'bright');
    console.log('='.repeat(60) + '\n');

    // 1. Registrar usuário
    log('📝 Passo 1: Registrando novo usuário...', 'cyan');
    const timestamp = Date.now();
    const registerData = {
      email: `checkout${timestamp}@test.com`,
      username: `checkout${timestamp}`,
      password: '123456',
      firstName: 'Usuário',
      lastName: 'Checkout'
    };

    const registerResponse = await axios.post(`${API_URL}/auth/register`, registerData);
    userId = registerResponse.data.user.id;
    log(`✅ Usuário criado: ${registerResponse.data.user.email}`, 'green');
    await delay(1000);

    // 2. Login
    log('\n🔐 Passo 2: Fazendo login...', 'cyan');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: registerData.email,
      password: registerData.password
    });
    token = loginResponse.data.token;
    log('✅ Login realizado com sucesso!', 'green');
    await delay(1000);

    // 3. Buscar itens
    log('\n📦 Passo 3: Buscando itens do catálogo...', 'cyan');
    const itemsResponse = await axios.get(`${API_URL}/items`);
    const items = itemsResponse.data.slice(0, 5); // Pegar 5 primeiros itens
    log(`✅ Encontrados ${items.length} itens para adicionar à lista`, 'green');
    await delay(1000);

    // 4. Criar lista
    log('\n📋 Passo 4: Criando lista de compras...', 'cyan');
    const listResponse = await axios.post(
      `${API_URL}/lists`,
      {
        name: `Compras do Mês - ${new Date().toLocaleDateString('pt-BR')}`,
        description: 'Lista para demonstração de checkout'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    listId = listResponse.data.list.id;
    log(`✅ Lista criada: "${listResponse.data.list.name}"`, 'green');
    await delay(1000);

    // 5. Adicionar itens à lista
    log('\n🛍️ Passo 5: Adicionando itens à lista...', 'cyan');
    for (const item of items) {
      await axios.post(
        `${API_URL}/lists/${listId}/items`,
        {
          itemId: item.id,
          quantity: Math.floor(Math.random() * 3) + 1,
          notes: 'Adicionado via demo'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      log(`   ✓ ${item.name} adicionado`, 'green');
      await delay(300);
    }
    log('✅ Todos os itens adicionados!', 'green');
    await delay(1000);

    // 6. Marcar alguns itens como comprados
    log('\n✔️ Passo 6: Marcando itens como comprados...', 'cyan');
    const listData = await axios.get(`${API_URL}/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const itemsToMark = listData.data.items.slice(0, 3);
    for (const item of itemsToMark) {
      await axios.put(
        `${API_URL}/lists/${listId}/items/${item.itemId}`,
        { purchased: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      log(`   ✓ ${item.itemName} marcado como comprado`, 'green');
      await delay(300);
    }
    log('✅ Itens marcados com sucesso!', 'green');
    await delay(1000);

    // 7. Visualizar resumo antes do checkout
    log('\n📊 Passo 7: Visualizando resumo da lista...', 'cyan');
    const summaryResponse = await axios.get(`${API_URL}/lists/${listId}/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const summary = summaryResponse.data.summary;
    console.log('');
    log(`   📋 Lista: ${summaryResponse.data.listName}`, 'yellow');
    log(`   📦 Total de itens: ${summary.totalItems}`, 'yellow');
    log(`   ✅ Itens comprados: ${summary.purchasedItems}`, 'yellow');
    log(`   💰 Valor estimado: R$ ${summary.estimatedTotal.toFixed(2)}`, 'yellow');
    console.log('');
    await delay(2000);

    // 8. CHECKOUT - O momento importante!
    console.log('\n' + '='.repeat(60));
    log('🚀 Passo 8: REALIZANDO CHECKOUT (MENSAGERIA ATIVADA)', 'magenta');
    console.log('='.repeat(60) + '\n');
    
    const startTime = Date.now();
    const checkoutResponse = await axios.post(
      `${API_URL}/lists/${listId}/checkout`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    log(`✅ ${checkoutResponse.data.message}`, 'green');
    log(`⚡ Status HTTP: ${checkoutResponse.status} (Accepted)`, 'green');
    log(`⏱️ Tempo de resposta: ${responseTime}ms`, 'green');
    log(`📝 Status: ${checkoutResponse.data.status}`, 'green');
    
    console.log('\n' + '='.repeat(60));
    log('🎯 OBSERVAÇÃO IMPORTANTE:', 'bright');
    console.log('='.repeat(60));
    log('A API respondeu IMEDIATAMENTE com 202 Accepted!', 'yellow');
    log('O processamento está acontecendo em BACKGROUND.', 'yellow');
    log('Verifique os terminais dos CONSUMERS para ver:', 'yellow');
    log('  • Notification Service → Enviando email', 'cyan');
    log('  • Analytics Service → Atualizando dashboard', 'cyan');
    console.log('='.repeat(60) + '\n');

    await delay(2000);

    // 9. Verificar status final da lista
    log('📋 Passo 9: Verificando status final da lista...', 'cyan');
    const finalListResponse = await axios.get(`${API_URL}/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`✅ Status da lista: ${finalListResponse.data.status}`, 'green');
    log(`📅 Finalizada em: ${new Date(finalListResponse.data.completedAt).toLocaleString('pt-BR')}`, 'green');

    console.log('\n' + '='.repeat(60));
    log('✅ DEMONSTRAÇÃO CONCLUÍDA COM SUCESSO!', 'bright');
    console.log('='.repeat(60) + '\n');

    log('Próximos passos:', 'bright');
    log('1. Verifique o RabbitMQ Management UI', 'yellow');
    log('2. Veja os gráficos de mensagens processadas', 'yellow');
    console.log('');

  } catch (error) {
    console.error('\n❌ Erro durante a demonstração:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Executar demo
runCheckoutDemo();

require('dotenv').config();
const rabbitmq = require('../shared/rabbitmq');

console.log('📊 Analytics Service iniciado');
console.log('📥 Aguardando mensagens de checkout...\n');

// Armazenamento em memória para estatísticas
const stats = {
  totalCheckouts: 0,
  totalRevenue: 0,
  totalItems: 0,
  checkoutHistory: []
};

// Conectar e consumir mensagens
(async () => {
  try {
    await rabbitmq.connect();

    // Consumir mensagens da fila de analytics
    await rabbitmq.consume('analytics_queue', 'list.checkout.#', async (message) => {
      const { listId, listName, summary, items, completedAt } = message;

      // Atualizar estatísticas
      stats.totalCheckouts++;
      stats.totalRevenue += summary.estimatedTotal;
      stats.totalItems += summary.totalItems;
      stats.checkoutHistory.push({
        listId,
        listName,
        total: summary.estimatedTotal,
        items: summary.totalItems,
        timestamp: completedAt
      });

      // Calcular média de gasto
      const avgSpending = stats.totalRevenue / stats.totalCheckouts;

      console.log('═══════════════════════════════════════════════════');
      console.log('📈 ANALYTICS: Dashboard atualizado');
      console.log('═══════════════════════════════════════════════════');
      console.log(`🛒 Checkout #${stats.totalCheckouts}`);
      console.log(`📋 Lista: ${listName} (ID: ${listId})`);
      console.log(`💰 Valor desta compra: R$ ${summary.estimatedTotal.toFixed(2)}`);
      console.log(`📦 Itens nesta compra: ${summary.totalItems}`);
      console.log('');
      console.log('📊 ESTATÍSTICAS GERAIS:');
      console.log(`   • Total de checkouts: ${stats.totalCheckouts}`);
      console.log(`   • Receita total: R$ ${stats.totalRevenue.toFixed(2)}`);
      console.log(`   • Total de itens vendidos: ${stats.totalItems}`);
      console.log(`   • Ticket médio: R$ ${avgSpending.toFixed(2)}`);
      console.log('═══════════════════════════════════════════════════');
      console.log('✅ Dashboard atualizado com sucesso!\n');

      // Simular delay de processamento
      await new Promise(resolve => setTimeout(resolve, 300));

      // Mostrar top 3 compras (se houver)
      if (stats.checkoutHistory.length >= 3) {
        const top3 = [...stats.checkoutHistory]
          .sort((a, b) => b.total - a.total)
          .slice(0, 3);

        console.log('🏆 TOP 3 MAIORES COMPRAS:');
        top3.forEach((checkout, index) => {
          console.log(`   ${index + 1}. ${checkout.listName} - R$ ${checkout.total.toFixed(2)} (${checkout.items} itens)`);
        });
        console.log('');
      }
    });

  } catch (error) {
    console.error('❌ Erro no Analytics Service:', error.message);
    process.exit(1);
  }
})();

// Tratamento de shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando Analytics Service...');
  console.log('\n📊 RESUMO FINAL:');
  console.log(`   • Total de checkouts processados: ${stats.totalCheckouts}`);
  console.log(`   • Receita total: R$ ${stats.totalRevenue.toFixed(2)}`);
  console.log(`   • Total de itens: ${stats.totalItems}`);
  
  await rabbitmq.close();
  process.exit(0);
});

require('dotenv').config();
const rabbitmq = require('../shared/rabbitmq');

console.log('🔔 Notification Service iniciado');
console.log('📥 Aguardando mensagens de checkout...\n');

// Conectar e consumir mensagens
(async () => {
  try {
    await rabbitmq.connect();

    // Consumir mensagens da fila de notificações
    await rabbitmq.consume('notification_queue', 'list.checkout.#', async (message) => {
      const { listId, userId, listName, summary, completedAt } = message;

      console.log('═══════════════════════════════════════════════════');
      console.log('📧 NOTIFICAÇÃO: Enviando comprovante de compra');
      console.log('═══════════════════════════════════════════════════');
      console.log(`📋 Lista: ${listName} (ID: ${listId})`);
      console.log(`👤 Usuário: ${userId}`);
      console.log(`💰 Total: R$ ${summary.estimatedTotal.toFixed(2)}`);
      console.log(`📦 Itens: ${summary.totalItems} (${summary.purchasedItems} comprados)`);
      console.log(`⏰ Finalizado em: ${new Date(completedAt).toLocaleString('pt-BR')}`);
      console.log('═══════════════════════════════════════════════════');
      console.log('✅ Email enviado com sucesso!\n');

      // Simular delay de envio de email
      await new Promise(resolve => setTimeout(resolve, 500));
    });

  } catch (error) {
    console.error('❌ Erro no Notification Service:', error.message);
    process.exit(1);
  }
})();

// Tratamento de shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando Notification Service...');
  await rabbitmq.close();
  process.exit(0);
});

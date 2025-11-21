require('dotenv').config();
const amqp = require('amqplib');

class RabbitMQManager {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.url = process.env.RABBITMQ_URL || '';
  }

  async connect() {
    try {
      // Validar URL
      if (!this.url || this.url.trim() === '') {
        throw new Error('RABBITMQ_URL não está configurada! Defina a variável de ambiente ou crie arquivo .env');
      }

      if (!this.url.startsWith('amqp://') && !this.url.startsWith('amqps://')) {
        throw new Error(`URL inválida: "${this.url}". Deve começar com amqp:// ou amqps://`);
      }

      console.log(`🔌 Conectando ao RabbitMQ...`);
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      
      console.log('✅ Conectado ao RabbitMQ com sucesso!');
      
      // Criar exchange se não existir
      await this.channel.assertExchange('shopping_events', 'topic', {
        durable: true
      });
      console.log('✅ Exchange "shopping_events" verificado');

      return this.channel;
    } catch (error) {
      console.error('❌ Erro ao conectar no RabbitMQ:', error.message);
      if (error.message.includes('RABBITMQ_URL')) {
        console.error('');
        console.error('💡 SOLUÇÃO:');
        console.error('   1. Defina a variável de ambiente:');
        console.error('      PowerShell: $env:RABBITMQ_URL="amqps://sua-url-aqui"');
        console.error('   2. Ou crie um arquivo .env com:');
        console.error('      RABBITMQ_URL=amqps://sua-url-aqui');
        console.error('');
      }
      throw error;
    }
  }

  async publish(exchange, routingKey, message) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      this.channel.publish(exchange, routingKey, messageBuffer, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now()
      });

      console.log(`📤 Mensagem publicada: ${routingKey}`, message);
      return true;
    } catch (error) {
      console.error('❌ Erro ao publicar mensagem:', error.message);
      throw error;
    }
  }

  async consume(queue, routingKey, callback) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      // Criar fila se não existir
      await this.channel.assertQueue(queue, {
        durable: true
      });

      // Fazer binding da fila com o exchange
      await this.channel.bindQueue(queue, 'shopping_events', routingKey);

      console.log(`📥 Consumindo mensagens da fila: ${queue}`);
      console.log(`🔗 Routing key: ${routingKey}`);

      // Consumir mensagens
      this.channel.consume(queue, async (msg) => {
        if (msg !== null) {
          try {
            const content = JSON.parse(msg.content.toString());
            console.log(`\n📨 Mensagem recebida em ${queue}:`, content);
            
            await callback(content);
            
            // Acknowledge da mensagem
            this.channel.ack(msg);
            console.log(`✅ Mensagem processada com sucesso\n`);
          } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error.message);
            // Rejeitar e não reenviar para fila
            this.channel.nack(msg, false, false);
          }
        }
      });

    } catch (error) {
      console.error('❌ Erro ao consumir mensagens:', error.message);
      throw error;
    }
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('🔌 Conexão com RabbitMQ fechada');
    } catch (error) {
      console.error('Erro ao fechar conexão:', error.message);
    }
  }
}

// Exportar instância única (singleton)
const rabbitmqManager = new RabbitMQManager();

module.exports = rabbitmqManager;

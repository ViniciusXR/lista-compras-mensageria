require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');
const rabbitmq = require('../../shared/rabbitmq');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(express.json());

// Database
const db = new JsonDatabase(path.join(__dirname, '../../data/lists.json'));

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Função auxiliar para buscar item no Item Service
const getItemFromService = async (itemId) => {
  try {
    const itemService = serviceRegistry.getService('item-service');
    const response = await axios.get(`${itemService.url}/items/${itemId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching item:', error.message);
    return null;
  }
};

// Função auxiliar para calcular summary
const calculateSummary = (items) => {
  const totalItems = items.length;
  const purchasedItems = items.filter(item => item.purchased).length;
  const estimatedTotal = items.reduce((sum, item) => sum + (item.estimatedPrice * item.quantity), 0);

  return {
    totalItems,
    purchasedItems,
    estimatedTotal: Math.round(estimatedTotal * 100) / 100
  };
};

// Rotas de listas
app.post('/lists', authenticateToken, (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name é obrigatório' });
    }

    const list = db.create({
      userId: req.user.id,
      name,
      description: description || '',
      status: 'active',
      items: [],
      summary: {
        totalItems: 0,
        purchasedItems: 0,
        estimatedTotal: 0
      },
      updatedAt: new Date().toISOString()
    });

    res.status(201).json({
      message: 'Lista criada com sucesso',
      list
    });
  } catch (error) {
    console.error('Error in create list:', error);
    res.status(500).json({ error: 'Erro ao criar lista' });
  }
});

app.get('/lists', authenticateToken, (req, res) => {
  try {
    const lists = db.findMany({ userId: req.user.id });
    res.json(lists);
  } catch (error) {
    console.error('Error in get lists:', error);
    res.status(500).json({ error: 'Erro ao buscar listas' });
  }
});

app.get('/lists/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const list = db.findById(id);

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    // Verificar se a lista pertence ao usuário
    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar esta lista' });
    }

    res.json(list);
  } catch (error) {
    console.error('Error in get list:', error);
    res.status(500).json({ error: 'Erro ao buscar lista' });
  }
});

app.put('/lists/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const list = db.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para atualizar esta lista' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) {
      if (!['active', 'completed', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      updates.status = status;
    }

    const updatedList = db.update(id, updates);

    res.json({
      message: 'Lista atualizada com sucesso',
      list: updatedList
    });
  } catch (error) {
    console.error('Error in update list:', error);
    res.status(500).json({ error: 'Erro ao atualizar lista' });
  }
});

app.delete('/lists/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const list = db.findById(id);

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para deletar esta lista' });
    }

    db.delete(id);

    res.json({ message: 'Lista deletada com sucesso' });
  } catch (error) {
    console.error('Error in delete list:', error);
    res.status(500).json({ error: 'Erro ao deletar lista' });
  }
});

app.post('/lists/:id/items', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId, quantity, notes } = req.body;

    if (!itemId || !quantity) {
      return res.status(400).json({ error: 'ItemId e quantity são obrigatórios' });
    }

    const list = db.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para adicionar itens a esta lista' });
    }

    // Buscar dados do item
    const item = await getItemFromService(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado no catálogo' });
    }

    // Verificar se item já existe na lista
    const existingItemIndex = list.items.findIndex(i => i.itemId === itemId);
    if (existingItemIndex !== -1) {
      return res.status(400).json({ error: 'Item já existe na lista. Use PUT para atualizar.' });
    }

    // Adicionar item à lista
    list.items.push({
      itemId,
      itemName: item.name,
      quantity,
      unit: item.unit,
      estimatedPrice: item.averagePrice,
      purchased: false,
      notes: notes || '',
      addedAt: new Date().toISOString()
    });

    // Recalcular summary
    list.summary = calculateSummary(list.items);

    const updatedList = db.update(id, { items: list.items, summary: list.summary });

    res.status(201).json({
      message: 'Item adicionado à lista com sucesso',
      list: updatedList
    });
  } catch (error) {
    console.error('Error in add item to list:', error);
    res.status(500).json({ error: 'Erro ao adicionar item à lista' });
  }
});

app.put('/lists/:id/items/:itemId', authenticateToken, (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { quantity, estimatedPrice, purchased, notes } = req.body;

    const list = db.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para atualizar itens desta lista' });
    }

    const itemIndex = list.items.findIndex(i => i.itemId === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item não encontrado na lista' });
    }

    // Atualizar item
    if (quantity !== undefined) list.items[itemIndex].quantity = quantity;
    if (estimatedPrice !== undefined) list.items[itemIndex].estimatedPrice = estimatedPrice;
    if (purchased !== undefined) list.items[itemIndex].purchased = purchased;
    if (notes !== undefined) list.items[itemIndex].notes = notes;

    // Recalcular summary
    list.summary = calculateSummary(list.items);

    const updatedList = db.update(id, { items: list.items, summary: list.summary });

    res.json({
      message: 'Item atualizado com sucesso',
      list: updatedList
    });
  } catch (error) {
    console.error('Error in update item in list:', error);
    res.status(500).json({ error: 'Erro ao atualizar item na lista' });
  }
});

app.delete('/lists/:id/items/:itemId', authenticateToken, (req, res) => {
  try {
    const { id, itemId } = req.params;

    const list = db.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para remover itens desta lista' });
    }

    const itemIndex = list.items.findIndex(i => i.itemId === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item não encontrado na lista' });
    }

    // Remover item
    list.items.splice(itemIndex, 1);

    // Recalcular summary
    list.summary = calculateSummary(list.items);

    const updatedList = db.update(id, { items: list.items, summary: list.summary });

    res.json({
      message: 'Item removido da lista com sucesso',
      list: updatedList
    });
  } catch (error) {
    console.error('Error in delete item from list:', error);
    res.status(500).json({ error: 'Erro ao remover item da lista' });
  }
});

app.get('/lists/:id/summary', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const list = db.findById(id);

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar esta lista' });
    }

    res.json({
      listId: list.id,
      listName: list.name,
      summary: list.summary
    });
  } catch (error) {
    console.error('Error in get list summary:', error);
    res.status(500).json({ error: 'Erro ao buscar resumo da lista' });
  }
});

// 🛒 CHECKOUT - Finalizar compra (envia mensagem assíncrona)
app.post('/lists/:id/checkout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const list = db.findById(id);

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para finalizar esta lista' });
    }

    if (list.items.length === 0) {
      return res.status(400).json({ error: 'Lista vazia. Adicione itens antes de finalizar.' });
    }

    // Atualizar status para completed
    const updatedList = db.update(id, { 
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    // Publicar mensagem no RabbitMQ de forma assíncrona
    const message = {
      listId: updatedList.id,
      userId: updatedList.userId,
      listName: updatedList.name,
      summary: updatedList.summary,
      items: updatedList.items,
      completedAt: updatedList.completedAt,
      timestamp: new Date().toISOString()
    };

    // Não aguardar o publish - fire and forget
    rabbitmq.publish('shopping_events', 'list.checkout.completed', message)
      .catch(err => console.error('Erro ao publicar no RabbitMQ:', err.message));

    // Retornar resposta imediatamente (202 Accepted)
    res.status(202).json({
      message: 'Checkout realizado com sucesso! Processamento iniciado.',
      list: updatedList,
      status: 'accepted'
    });

  } catch (error) {
    console.error('Error in checkout:', error);
    res.status(500).json({ error: 'Erro ao finalizar compra' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'list-service' });
});

// Inicializar servidor
app.listen(PORT, async () => {
  console.log(`List Service running on port ${PORT}`);
  
  // Conectar ao RabbitMQ
  try {
    await rabbitmq.connect();
  } catch (error) {
    console.error('⚠️ Falha ao conectar RabbitMQ. Continuando sem mensageria...');
  }
  
  // Registrar no Service Registry
  serviceRegistry.register('list-service', `http://localhost:${PORT}`, {
    version: '1.0.0',
    description: 'Shopping list management service'
  });

  // Cleanup ao sair
  process.on('SIGINT', async () => {
    serviceRegistry.unregister('list-service');
    await rabbitmq.close();
    process.exit();
  });
});

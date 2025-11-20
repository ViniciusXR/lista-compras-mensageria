const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const serviceRegistry = require('../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(express.json());

// Circuit Breaker simples
class CircuitBreaker {
  constructor(serviceName, threshold = 3, timeout = 60000) {
    this.serviceName = serviceName;
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.serviceName}`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.log(`[CircuitBreaker] Circuit opened for ${this.serviceName}`);
    }
  }
}

// Circuit breakers para cada serviço
const circuitBreakers = {
  'user-service': new CircuitBreaker('user-service'),
  'item-service': new CircuitBreaker('item-service'),
  'list-service': new CircuitBreaker('list-service')
};

// Middleware de log
app.use((req, res, next) => {
  console.log(`[Gateway] ${req.method} ${req.url}`);
  next();
});

// Middleware de autenticação para rotas protegidas
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

// Função para fazer proxy de requisições
const proxyRequest = async (serviceName, path, method, data, headers) => {
  try {
    const service = serviceRegistry.getService(serviceName);
    const url = `${service.url}${path}`;

    const breaker = circuitBreakers[serviceName];
    
    return await breaker.execute(async () => {
      const response = await axios({
        method,
        url,
        data,
        headers,
        timeout: 10000
      });
      return response.data;
    });
  } catch (error) {
    if (error.response) {
      throw { status: error.response.status, data: error.response.data };
    }
    throw { status: 503, data: { error: `Service ${serviceName} unavailable: ${error.message}` } };
  }
};

// Rotas do User Service
app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await proxyRequest('user-service', '/auth/register', 'POST', req.body, {});
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const result = await proxyRequest('user-service', '/auth/login', 'POST', req.body, {});
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await proxyRequest('user-service', `/users/${req.params.id}`, 'GET', null, {
      authorization: req.headers.authorization
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const result = await proxyRequest('user-service', `/users/${req.params.id}`, 'PUT', req.body, {
      authorization: req.headers.authorization
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

// Rotas do Item Service
app.get('/api/items', async (req, res) => {
  try {
    const queryString = new URLSearchParams(req.query).toString();
    const path = queryString ? `/items?${queryString}` : '/items';
    const result = await proxyRequest('item-service', path, 'GET', null, {});
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const result = await proxyRequest('item-service', `/items/${req.params.id}`, 'GET', null, {});
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const result = await proxyRequest('item-service', '/items', 'POST', req.body, {
      authorization: req.headers.authorization
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const result = await proxyRequest('item-service', `/items/${req.params.id}`, 'PUT', req.body, {
      authorization: req.headers.authorization
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const result = await proxyRequest('item-service', '/categories', 'GET', null, {});
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.get('/api/items/search', async (req, res) => {
  try {
    const queryString = new URLSearchParams(req.query).toString();
    const result = await proxyRequest('item-service', `/search?${queryString}`, 'GET', null, {});
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

// Rotas do List Service
app.post('/api/lists', async (req, res) => {
  try {
    const result = await proxyRequest('list-service', '/lists', 'POST', req.body, {
      authorization: req.headers.authorization
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.get('/api/lists', async (req, res) => {
  try {
    const result = await proxyRequest('list-service', '/lists', 'GET', null, {
      authorization: req.headers.authorization
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.get('/api/lists/:id', async (req, res) => {
  try {
    const result = await proxyRequest('list-service', `/lists/${req.params.id}`, 'GET', null, {
      authorization: req.headers.authorization
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.put('/api/lists/:id', async (req, res) => {
  try {
    const result = await proxyRequest('list-service', `/lists/${req.params.id}`, 'PUT', req.body, {
      authorization: req.headers.authorization
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.delete('/api/lists/:id', async (req, res) => {
  try {
    const result = await proxyRequest('list-service', `/lists/${req.params.id}`, 'DELETE', null, {
      authorization: req.headers.authorization
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.post('/api/lists/:id/items', async (req, res) => {
  try {
    const result = await proxyRequest('list-service', `/lists/${req.params.id}/items`, 'POST', req.body, {
      authorization: req.headers.authorization
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.put('/api/lists/:id/items/:itemId', async (req, res) => {
  try {
    const result = await proxyRequest('list-service', `/lists/${req.params.id}/items/${req.params.itemId}`, 'PUT', req.body, {
      authorization: req.headers.authorization
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.delete('/api/lists/:id/items/:itemId', async (req, res) => {
  try {
    const result = await proxyRequest('list-service', `/lists/${req.params.id}/items/${req.params.itemId}`, 'DELETE', null, {
      authorization: req.headers.authorization
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.get('/api/lists/:id/summary', async (req, res) => {
  try {
    const result = await proxyRequest('list-service', `/lists/${req.params.id}/summary`, 'GET', null, {
      authorization: req.headers.authorization
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

// Endpoint agregado: Dashboard
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    // Buscar listas do usuário
    const lists = await proxyRequest('list-service', '/lists', 'GET', null, {
      authorization: req.headers.authorization
    });

    // Calcular estatísticas
    const totalLists = lists.length;
    const activeLists = lists.filter(l => l.status === 'active').length;
    const completedLists = lists.filter(l => l.status === 'completed').length;
    
    let totalItems = 0;
    let totalPurchased = 0;
    let totalEstimated = 0;

    lists.forEach(list => {
      totalItems += list.summary.totalItems;
      totalPurchased += list.summary.purchasedItems;
      totalEstimated += list.summary.estimatedTotal;
    });

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username
      },
      statistics: {
        totalLists,
        activeLists,
        completedLists,
        totalItems,
        totalPurchased,
        totalEstimated: Math.round(totalEstimated * 100) / 100,
        completionRate: totalItems > 0 ? Math.round((totalPurchased / totalItems) * 100) : 0
      },
      recentLists: lists.slice(0, 5)
    });
  } catch (error) {
    res.status(error.status || 500).json(error.data || { error: 'Erro ao buscar dashboard' });
  }
});

// Endpoint agregado: Busca global
app.get('/api/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter q é obrigatório' });
    }

    // Buscar itens
    const items = await proxyRequest('item-service', `/search?q=${encodeURIComponent(q)}`, 'GET', null, {});

    // Buscar listas do usuário
    const allLists = await proxyRequest('list-service', '/lists', 'GET', null, {
      authorization: req.headers.authorization
    });

    // Filtrar listas que contenham o termo no nome ou descrição
    const lists = allLists.filter(list => 
      list.name.toLowerCase().includes(q.toLowerCase()) ||
      (list.description && list.description.toLowerCase().includes(q.toLowerCase()))
    );

    res.json({
      query: q,
      results: {
        items,
        lists
      }
    });
  } catch (error) {
    res.status(error.status || 500).json(error.data || { error: 'Erro ao realizar busca' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  const services = serviceRegistry.getAllServices();
  const health = {
    gateway: 'healthy',
    services: {}
  };

  for (const [name, data] of Object.entries(services)) {
    health.services[name] = {
      status: data.status,
      lastHeartbeat: data.lastHeartbeat
    };
  }

  const allHealthy = Object.values(services).every(s => s.status === 'healthy');
  const status = allHealthy ? 200 : 503;

  res.status(status).json(health);
});

// Registry
app.get('/registry', (req, res) => {
  const services = serviceRegistry.getAllServices();
  res.json(services);
});

// Inicializar servidor
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Service registry: http://localhost:${PORT}/registry`);
});

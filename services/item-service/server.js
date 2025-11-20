const express = require('express');
const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Database
const db = new JsonDatabase(path.join(__dirname, '../../data/items.json'));

// Middleware de autenticação simples (verifica apenas presença do token)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  // Para simplicidade, apenas verifica se o token existe
  // Em produção, deveria validar com o User Service
  next();
};

// Seed inicial de dados
const seedData = () => {
  const items = db.findAll();
  
  if (items.length === 0) {
    console.log('Seeding initial items...');
    
    const initialItems = [
      // Alimentos
      { name: 'Arroz Branco', category: 'Alimentos', brand: 'Tio João', unit: 'kg', averagePrice: 5.99, barcode: '7891234567890', description: 'Arroz tipo 1', active: true },
      { name: 'Feijão Preto', category: 'Alimentos', brand: 'Kicaldo', unit: 'kg', averagePrice: 7.50, barcode: '7891234567891', description: 'Feijão tipo 1', active: true },
      { name: 'Macarrão Espaguete', category: 'Alimentos', brand: 'Barilla', unit: 'un', averagePrice: 4.99, barcode: '7891234567892', description: 'Macarrão 500g', active: true },
      { name: 'Óleo de Soja', category: 'Alimentos', brand: 'Liza', unit: 'litro', averagePrice: 8.99, barcode: '7891234567893', description: 'Óleo de soja 900ml', active: true },
      { name: 'Açúcar Cristal', category: 'Alimentos', brand: 'União', unit: 'kg', averagePrice: 3.99, barcode: '7891234567894', description: 'Açúcar cristal 1kg', active: true },
      { name: 'Sal Refinado', category: 'Alimentos', brand: 'Cisne', unit: 'kg', averagePrice: 1.99, barcode: '7891234567895', description: 'Sal refinado 1kg', active: true },
      { name: 'Café em Pó', category: 'Alimentos', brand: 'Pilão', unit: 'un', averagePrice: 12.99, barcode: '7891234567896', description: 'Café tradicional 500g', active: true },
      { name: 'Leite Integral', category: 'Alimentos', brand: 'Italac', unit: 'litro', averagePrice: 4.50, barcode: '7891234567897', description: 'Leite UHT integral', active: true },
      
      // Limpeza
      { name: 'Detergente Líquido', category: 'Limpeza', brand: 'Ypê', unit: 'un', averagePrice: 2.49, barcode: '7891234567898', description: 'Detergente 500ml', active: true },
      { name: 'Água Sanitária', category: 'Limpeza', brand: 'Qboa', unit: 'litro', averagePrice: 3.99, barcode: '7891234567899', description: 'Água sanitária 1L', active: true },
      { name: 'Sabão em Pó', category: 'Limpeza', brand: 'OMO', unit: 'kg', averagePrice: 15.99, barcode: '7891234567900', description: 'Sabão em pó 1kg', active: true },
      { name: 'Desinfetante', category: 'Limpeza', brand: 'Pinho Sol', unit: 'litro', averagePrice: 6.99, barcode: '7891234567901', description: 'Desinfetante 1L', active: true },
      { name: 'Esponja de Limpeza', category: 'Limpeza', brand: 'Scotch-Brite', unit: 'un', averagePrice: 3.99, barcode: '7891234567902', description: 'Esponja dupla face', active: true },
      
      // Higiene
      { name: 'Sabonete', category: 'Higiene', brand: 'Dove', unit: 'un', averagePrice: 2.99, barcode: '7891234567903', description: 'Sabonete em barra 90g', active: true },
      { name: 'Shampoo', category: 'Higiene', brand: 'Pantene', unit: 'un', averagePrice: 12.99, barcode: '7891234567904', description: 'Shampoo 400ml', active: true },
      { name: 'Pasta de Dente', category: 'Higiene', brand: 'Colgate', unit: 'un', averagePrice: 4.99, barcode: '7891234567905', description: 'Creme dental 90g', active: true },
      { name: 'Papel Higiênico', category: 'Higiene', brand: 'Personal', unit: 'un', averagePrice: 15.99, barcode: '7891234567906', description: 'Papel higiênico 12 rolos', active: true },
      
      // Bebidas
      { name: 'Refrigerante Cola', category: 'Bebidas', brand: 'Coca-Cola', unit: 'litro', averagePrice: 6.99, barcode: '7891234567907', description: 'Refrigerante 2L', active: true },
      { name: 'Suco de Laranja', category: 'Bebidas', brand: 'Del Valle', unit: 'litro', averagePrice: 5.49, barcode: '7891234567908', description: 'Suco integral 1L', active: true },
      { name: 'Água Mineral', category: 'Bebidas', brand: 'Crystal', unit: 'litro', averagePrice: 1.99, barcode: '7891234567909', description: 'Água mineral 1,5L', active: true },
      
      // Padaria
      { name: 'Pão Francês', category: 'Padaria', brand: 'Padaria Local', unit: 'kg', averagePrice: 12.99, barcode: '7891234567910', description: 'Pão francês fresco', active: true },
      { name: 'Pão de Forma', category: 'Padaria', brand: 'Pullman', unit: 'un', averagePrice: 8.99, barcode: '7891234567911', description: 'Pão de forma integral', active: true },
      { name: 'Bolo de Chocolate', category: 'Padaria', brand: 'Padaria Local', unit: 'un', averagePrice: 15.99, barcode: '7891234567912', description: 'Bolo caseiro', active: true }
    ];

    initialItems.forEach(item => db.create(item));
    console.log(`Seeded ${initialItems.length} items`);
  }
};

// Executar seed ao iniciar
seedData();

// Rotas
app.get('/items', (req, res) => {
  try {
    const { category, name } = req.query;
    let items = db.findAll();

    // Filtrar por categoria
    if (category) {
      items = items.filter(item => 
        item.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Filtrar por nome
    if (name) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(name.toLowerCase())
      );
    }

    // Filtrar apenas itens ativos
    items = items.filter(item => item.active !== false);

    res.json(items);
  } catch (error) {
    console.error('Error in get items:', error);
    res.status(500).json({ error: 'Erro ao buscar itens' });
  }
});

app.get('/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const item = db.findById(id);

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error in get item:', error);
    res.status(500).json({ error: 'Erro ao buscar item' });
  }
});

app.post('/items', authenticateToken, (req, res) => {
  try {
    const { name, category, brand, unit, averagePrice, barcode, description } = req.body;

    if (!name || !category || !unit) {
      return res.status(400).json({ error: 'Name, category e unit são obrigatórios' });
    }

    const item = db.create({
      name,
      category,
      brand: brand || '',
      unit,
      averagePrice: averagePrice || 0,
      barcode: barcode || '',
      description: description || '',
      active: true
    });

    res.status(201).json({
      message: 'Item criado com sucesso',
      item
    });
  } catch (error) {
    console.error('Error in create item:', error);
    res.status(500).json({ error: 'Erro ao criar item' });
  }
});

app.put('/items/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, brand, unit, averagePrice, barcode, description, active } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (brand !== undefined) updates.brand = brand;
    if (unit !== undefined) updates.unit = unit;
    if (averagePrice !== undefined) updates.averagePrice = averagePrice;
    if (barcode !== undefined) updates.barcode = barcode;
    if (description !== undefined) updates.description = description;
    if (active !== undefined) updates.active = active;

    const updatedItem = db.update(id, updates);

    if (!updatedItem) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    res.json({
      message: 'Item atualizado com sucesso',
      item: updatedItem
    });
  } catch (error) {
    console.error('Error in update item:', error);
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

app.get('/categories', (req, res) => {
  try {
    const items = db.findAll();
    const categories = [...new Set(items.map(item => item.category))];
    
    res.json(categories);
  } catch (error) {
    console.error('Error in get categories:', error);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

app.get('/search', (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter q é obrigatório' });
    }

    const items = db.search('name', q);
    const activeItems = items.filter(item => item.active !== false);

    res.json(activeItems);
  } catch (error) {
    console.error('Error in search items:', error);
    res.status(500).json({ error: 'Erro ao buscar itens' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'item-service' });
});

// Inicializar servidor
app.listen(PORT, () => {
  console.log(`Item Service running on port ${PORT}`);
  
  // Registrar no Service Registry
  serviceRegistry.register('item-service', `http://localhost:${PORT}`, {
    version: '1.0.0',
    description: 'Item catalog service'
  });

  // Cleanup ao sair
  process.on('SIGINT', () => {
    serviceRegistry.unregister('item-service');
    process.exit();
  });
});

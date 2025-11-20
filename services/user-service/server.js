const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(express.json());

// Database
const db = new JsonDatabase(path.join(__dirname, '../../data/users.json'));

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

// Rotas de autenticação
app.post('/auth/register', async (req, res) => {
  try {
    const { email, username, password, firstName, lastName, preferences } = req.body;

    // Validações
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username e password são obrigatórios' });
    }

    // Verificar se email já existe
    const existingUser = db.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Verificar se username já existe
    const existingUsername = db.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username já cadastrado' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    const user = db.create({
      email,
      username,
      password: hashedPassword,
      firstName: firstName || '',
      lastName: lastName || '',
      preferences: preferences || {
        defaultStore: '',
        currency: 'BRL'
      },
      updatedAt: new Date().toISOString()
    });

    // Remover senha do retorno
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if ((!email && !username) || !password) {
      return res.status(400).json({ error: 'Email/username e password são obrigatórios' });
    }

    // Buscar usuário
    const user = email 
      ? db.findOne({ email })
      : db.findOne({ username });

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remover senha do retorno
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Rotas de usuários
app.get('/users/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const user = db.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Remover senha do retorno
    const { password: _, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error in get user:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

app.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o usuário está atualizando seu próprio perfil
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Você só pode atualizar seu próprio perfil' });
    }

    const { email, username, firstName, lastName, preferences, password } = req.body;
    
    const updates = {};
    
    if (email) {
      // Verificar se email já existe em outro usuário
      const existingUser = db.findOne({ email });
      if (existingUser && existingUser.id !== id) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
      updates.email = email;
    }
    
    if (username) {
      // Verificar se username já existe em outro usuário
      const existingUsername = db.findOne({ username });
      if (existingUsername && existingUsername.id !== id) {
        return res.status(400).json({ error: 'Username já cadastrado' });
      }
      updates.username = username;
    }
    
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (preferences) updates.preferences = preferences;
    
    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = db.update(id, updates);

    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Remover senha do retorno
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      message: 'Usuário atualizado com sucesso',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error in update user:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

// Inicializar servidor
app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
  
  // Registrar no Service Registry
  serviceRegistry.register('user-service', `http://localhost:${PORT}`, {
    version: '1.0.0',
    description: 'User management and authentication service'
  });

  // Cleanup ao sair
  process.on('SIGINT', () => {
    serviceRegistry.unregister('user-service');
    process.exit();
  });
});

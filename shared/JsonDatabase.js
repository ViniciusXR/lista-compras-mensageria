const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class JsonDatabase {
  constructor(filename) {
    this.filename = filename;
    this.ensureFileExists();
  }

  ensureFileExists() {
    const dir = path.dirname(this.filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filename)) {
      fs.writeFileSync(this.filename, JSON.stringify([], null, 2));
    }
  }

  read() {
    try {
      const data = fs.readFileSync(this.filename, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading database:', error);
      return [];
    }
  }

  write(data) {
    try {
      fs.writeFileSync(this.filename, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Error writing database:', error);
      return false;
    }
  }

  findAll() {
    return this.read();
  }

  findById(id) {
    const data = this.read();
    return data.find(item => item.id === id);
  }

  findOne(criteria) {
    const data = this.read();
    return data.find(item => {
      return Object.keys(criteria).every(key => item[key] === criteria[key]);
    });
  }

  findMany(criteria) {
    const data = this.read();
    return data.filter(item => {
      return Object.keys(criteria).every(key => item[key] === criteria[key]);
    });
  }

  create(newItem) {
    const data = this.read();
    const item = {
      id: uuidv4(),
      ...newItem,
      createdAt: new Date().toISOString()
    };
    data.push(item);
    this.write(data);
    return item;
  }

  update(id, updates) {
    const data = this.read();
    const index = data.findIndex(item => item.id === id);
    
    if (index === -1) {
      return null;
    }

    data[index] = {
      ...data[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.write(data);
    return data[index];
  }

  delete(id) {
    const data = this.read();
    const index = data.findIndex(item => item.id === id);
    
    if (index === -1) {
      return false;
    }

    data.splice(index, 1);
    this.write(data);
    return true;
  }

  search(field, query) {
    const data = this.read();
    const lowerQuery = query.toLowerCase();
    return data.filter(item => 
      item[field] && item[field].toLowerCase().includes(lowerQuery)
    );
  }
}

module.exports = JsonDatabase;

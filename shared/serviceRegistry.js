const fs = require('fs');
const path = require('path');
const axios = require('axios');

const REGISTRY_FILE = path.join(__dirname, '../data/service-registry.json');
const HEALTH_CHECK_INTERVAL = 30000; // 30 segundos

class ServiceRegistry {
  constructor() {
    this.ensureRegistryFile();
    this.startHealthChecks();
  }

  ensureRegistryFile() {
    const dir = path.dirname(REGISTRY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(REGISTRY_FILE)) {
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify({}, null, 2));
    }
  }

  readRegistry() {
    try {
      const data = fs.readFileSync(REGISTRY_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading registry:', error);
      return {};
    }
  }

  writeRegistry(data) {
    try {
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing registry:', error);
    }
  }

  register(serviceName, serviceUrl, metadata = {}) {
    const registry = this.readRegistry();
    registry[serviceName] = {
      url: serviceUrl,
      status: 'healthy',
      lastHeartbeat: new Date().toISOString(),
      metadata,
      registeredAt: registry[serviceName]?.registeredAt || new Date().toISOString()
    };
    this.writeRegistry(registry);
    console.log(`[ServiceRegistry] ${serviceName} registered at ${serviceUrl}`);
  }

  unregister(serviceName) {
    const registry = this.readRegistry();
    delete registry[serviceName];
    this.writeRegistry(registry);
    console.log(`[ServiceRegistry] ${serviceName} unregistered`);
  }

  getService(serviceName) {
    const registry = this.readRegistry();
    const service = registry[serviceName];
    
    if (!service) {
      throw new Error(`Service ${serviceName} not found in registry`);
    }
    
    if (service.status === 'unhealthy') {
      throw new Error(`Service ${serviceName} is unhealthy`);
    }
    
    return service;
  }

  getAllServices() {
    return this.readRegistry();
  }

  async checkHealth(serviceName, serviceUrl) {
    try {
      const response = await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async updateServiceHealth(serviceName, isHealthy) {
    const registry = this.readRegistry();
    if (registry[serviceName]) {
      registry[serviceName].status = isHealthy ? 'healthy' : 'unhealthy';
      registry[serviceName].lastHeartbeat = new Date().toISOString();
      this.writeRegistry(registry);
    }
  }

  startHealthChecks() {
    setInterval(async () => {
      const registry = this.readRegistry();
      
      for (const [serviceName, serviceData] of Object.entries(registry)) {
        const isHealthy = await this.checkHealth(serviceName, serviceData.url);
        await this.updateServiceHealth(serviceName, isHealthy);
        
        if (!isHealthy) {
          console.log(`[ServiceRegistry] ${serviceName} is unhealthy`);
        }
      }
    }, HEALTH_CHECK_INTERVAL);
  }
}

// Singleton instance
const registryInstance = new ServiceRegistry();

module.exports = {
  register: (name, url, metadata) => registryInstance.register(name, url, metadata),
  unregister: (name) => registryInstance.unregister(name),
  getService: (name) => registryInstance.getService(name),
  getAllServices: () => registryInstance.getAllServices(),
};

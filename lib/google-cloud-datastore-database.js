const Datastore = require('@google-cloud/datastore');
const util = require('util');
const Connector = require('loopback-connector').Connector;
const path = require('path');

exports.initialize = function initializeDataSource(dataSource, callback) {
  dataSource.connector = new GoogleCloudDatastore(dataSource.settings);
  process.nextTick(() => {
    callback();
  });
};

class GoogleCloudDatastore {
  constructor(dataSourceProperties) {
    this._models = {};

    const datastore = new Datastore({
      keyFilename: path.resolve(dataSourceProperties.keyFilename),
      projectId: dataSourceProperties.projectId,
    });

    this.db = datastore;
  }

  /**
   * Create a new Entity ID
   * @param {String} model The model name
   * @param {Object} data The property/value pairs to be created
   */
  createEntityKey(model, data) {
    const id = data ? data.id : undefined;
    return id ? this.db.key([model, Number.parseInt(id)]) : this.db.key(model);
  }

  /**
   * Create a new Entity
   * @param {Object} obj The property/value pairs to be created
   * @param {String} key The id value for this document
   */
  createEntity(obj, key) {
    const data = Object.assign(obj, {
      id: key.name,
    });
    return {
      data,
      key,
    };
  }

  /**
   * Generic method for creating a new Entity
   * @param {String} model The model name
   * @param {Object} data The property/value pairs to be created
   * @param {String} operation The operation to execute (eg. Save/Update)
   */
  async addOrUpdateEntity(model, data, operation = 'save') {
    try {
      const key = this.createEntityKey(model, data);
      const entity = this.createEntity(data, key);

      let result = null;

      if (operation === 'save') {
        result = await this.db.insert(entity);
        const id = result[0].mutationResults[0].key.path[0].id;

        return Promise.resolve(id);
      }
      result = await this.db.update(entity);

      return Promise.resolve({});
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create new model Entity
   * @param {String} model The model name
   * @param {Object} data The property/value pairs to be created
   * @param {Object} options The options object
   * @param {Function} [cb] The callback function
   */
  async create(model, data, options, callback) {
    try {
      const result = await this.addOrUpdateEntity(model, data);

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Complete the entity objects with their ids
   * @param {Array} entities The array of entities
   */
  completeEntities(entities) {
    const result = entities.map((entity) => {
      const id = entity[this.db.KEY].id;
      return Object.assign(entity, {id});
    });

    return result;
  }

  /**
   * Find matching model Entity by the id
   * @param {String} model The model name
   * @param {String} id The Entity id
   */
  async findById(model, id) {
    try {
      const key = await this.db.key([model, Number.parseInt(id)]);

      const entities = await this.db.get(key);

      const result = this.completeEntities(entities);

      return Promise.resolve(result);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all records of an Entity
   * @param {String} model The model name
   */
  async getAllEntity(model) {
    try {
      const query = this.db.createQuery(model);

      const entities = await query.run();

      const result = this.completeEntities(entities[0]);

      return Promise.resolve(result);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find matching model Entities by the filter
   * @param {String} model The model name
   * @param {Object} filter The filter
   * @param {Object} options The options object
   * @param {Function} [cb] The callback function
   */
  async all(model, filter, options, callback) {
    const where = filter.where;
    try {
      let result;

      if (where && where.id) {
        result = await this.findById(model, where.id);
      } else if (where) {
        const query = this.buildQuery(model, where);
        const entities = await query.run();

        result = this.completeEntities(entities[0]);
      } else {
        result = await this.getAllEntity(model);
      }

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Internal method for building query
   * @param {String} model The model name
   * @param {Object} where The filter
   */
  buildQuery(model, where) {
    const filters = Object.keys(where).map((key) => ({
      [key]: where[key],
    }));

    let query = this.db.createQuery(model);

    for (let i = 0; i < filters.length; i += 1) {
      query = this.addFilterToQuery(query, filters[i]);
    }

    return query;
  }

  /**
   * Add new filter to a Query
   * @param {Query} query Datastore Query
   * @param {Object} filter The filter object
   */
  addFilterToQuery(query, filter) {
    const key = Object.keys(filter)[0];
    const value = Object.values(filter)[0];
    return query.filter(key, '=', value);
  }

  /**
   * Count the number of Entities of a model
   * @param {String} model The model name
   * @param {Object} where The filter object
   * @param {Object} options The options object
   * @param {Function} callback The callback function
   */
  async count(model, where, options, callback) {
    try {
      if (where && where.id) {
        const key = this.db.key([model, Number.parseInt(where.id)]);
        const result = await this.db.get(key);

        callback(null, result.length);
      } else {
        const result = await this.getAllEntity(model);

        callback(null, result.length);
      }
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Validates if model Entity exists
   * @param {String} model The model name
   * @param {String} id The Entity id
   * @param {Object} options The options object
   * @param {Function} [cb] The callback function
   */
  async exists(model, id, options, callback) {
    const key = this.db.key([model, Number.parseInt(id)]);

    try {
      const result = await this.db.get(key);

      if (result.length > 0) return Promise.resolve(true);
      return Promise.resolve(false);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Find or create an Entity
   * @param {String} model The model name
   * @param {Object} filter The filter object
   * @param {Object} data The property/value pairs to be created
   * @param {Object} options The options object
   * @param {Function} callback The callback function
   */
  async findOrCreate(model, filter, data, options, callback) {
    try {
      const where = filter ? filter.where : undefined;
      const id = where ? where.id : 0;

      const newData = Object.assign(data, {
        id,
      });

      let result = await this.findById(model, id);

      if (result.length === 0) {
        result = await this.addOrUpdateEntity(model, newData);
      }

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Replace matching Entity
   * @param {String} model The model name
   * @param {String} id The entity id
   * @param {Object} data The property/value pairs to be replaced
   * @param {Object} options The options object
   * @param {Function} callback The callback function
   */
  async replaceById(model, id, data, options, callback) {
    try {
      const result = await this.deleteData(model, id, data);

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Replace or create an Entity
   * @param {String} model The model name
   * @param {Object} data The property/value pairs to be replaced or created
   * @param {Object} options The options object
   * @param {Function} callback The callback function
   */
  async replaceOrCreate(model, data, options, callback) {
    try {
      const result = await this.addOrUpdateEntity(model, data, 'update');

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Save an Entity
   * @param {String} model The model name
   * @param {Object} data The property/value pairs to be saved
   * @param {Object} options The option object
   * @param {Function} callback The callback function
   */
  async save(model, data, options, callback) {
    try {
      const result = await this.addOrUpdateEntity(model, data);

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Internal use for Update matching entity
   * @param {String} model The model name
   * @param {String} id The Entity id
   * @param {Object} data The property/value pairs to be updated
   */
  async updateInternal(model, id, data) {
    if (!id) throw new Error('Provide a valid entity Id');

    try {
      const exist = this.exists(model, id);

      if (!exist) throw new Error('Entity not found');

      const newData = Object.assign(data, {
        id,
      });

      await this.addOrUpdateEntity(model, newData, 'update');

      return Promise.resolve({});
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update matching Entity
   * @param {String} model The model name
   * @param {Object} where The filter object
   * @param {Object} data The property/value pairs to be updated
   * @param {Object} options The options object
   * @param {Function} callback The callback function
   */
  async update(model, where, data, options, callback) {
    try {
      const result = await this.updateInternal(model, where.id, data);

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Update matching entity attributes
   * @param {String} model The model name
   * @param {String} id The entity id
   * @param {Object} data The property/value pairs to be updated
   * @param {Object} options The options object
   * @param {Function} callback The callback function
   */
  async updateAttributes(model, id, data, options, callback) {
    try {
      const result = await this.updateInternal(model, id, data);

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Update or create an instance
   * @param {String} model The model name
   * @param {Object} data The property/value pairs to be updated or created
   * @param {Object} options The options object
   * @param {Function} callback The callback function
   */
  async updateOrCreate(model, data, options, callback) {
    try {
      const id = data ? data.id : undefined;
      const result = await this.updateInternal(model, id, data);

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Destroy data for internal use
   * @param {String} model The model name
   * @param {String} id The Entity id
   * @param {Object} data The null value to be used
   */
  async deleteData(model, id, data) {
    if (!id) throw new Error('Provide a valid Entity Id');

    try {
      const exist = await this.exists(model, id);

      if (!exist) throw new Error('Entity not found');

      const key = this.db.key([model, Number.parseInt(id)]);

      await this.db.delete(key);
      return Promise.resolve({});
    } catch (error) {
      throw error;
    }
  }

  /**
   * Destroy all Entities of a model
   * @param {String} model The model name
   * @param {Object} where The filter object
   * @param {Object} options The options object
   * @param {Function} [cb] The callback function
   */
  async destroyAll(model, where, options, callback) {
    try {
      if (where && where.id) {
        const result = await this.deleteData(model, where.id, null);

        callback(null, result);
      } else {
        const result = await this.getAllEntity(model);

        const keys = result.map((entity) => this.db.key([model, entity.id]));

        await this.db.delete(keys);
        callback(null, []);
      }
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Destroy Entity records
   * @param {String} model The model name
   * @param {String} id The Entity id
   * @param {Object} options The options object
   * @param {Function} [cb] The callback function
   */
  async destroyById(model, id, options, callback) {
    try {
      const result = await this.deleteData(model, id, null);

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }
}

util.inherits(GoogleCloudDatastore, Connector);
exports.RealtimeDatabase = GoogleCloudDatastore;

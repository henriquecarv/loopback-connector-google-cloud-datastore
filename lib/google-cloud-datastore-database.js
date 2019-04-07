const {Datastore} = require('@google-cloud/datastore');
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

    const {keyFilename, projectId} = dataSourceProperties;

    const datastore = new Datastore({
      keyFilename: path.resolve(keyFilename),
      projectId,
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
      const isSave = operation === 'save';

      if (isSave) {
        const result = await this.db.insert(entity);
        const {id} = result[0].mutationResults[0].key.path[0];

        return Promise.resolve(id);
      }

      await this.db.update(entity);

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
    const result = entities.map(entity => {
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
      const foundEntity = entities[0] !== undefined;

      if (foundEntity) {
        const result = this.completeEntities(entities);
        return Promise.resolve(result);
      }

      return Promise.resolve([]);
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
   * Internal method - Get Entities with query execution
   * @param {String} model The model name
   * @param {Object} filter The filter
   */
  async getResultsWithQuery(model, filter) {
    const query = this.buildQuery(model, filter);
    const entities = await query.run();

    return this.completeEntities(entities[0]);
  }

  /**
   * Internal method - Check if filter object has at least one valid property
   * @param {Object} filter The filter
   */
  hasFilter({where, order, limit, fields, skip}) {
    if (where || limit || fields || order || skip) return true;
    return false;
  }

  /**
   * Find matching model Entities by the filter
   * @param {String} model The model name
   * @param {Object} filter The filter
   * @param {Object} options The options object
   * @param {Function} [cb] The callback function
   */
  async all(model, filter, options, callback) {
    const {where} = filter;

    try {
      let result;

      if (where && where.id) {
        result = await this.findById(model, where.id);
      } else if (this.hasFilter(filter)) {
        result = await this.getResultsWithQuery(model, filter);
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
   * @param {Object} filter The filter
   */
  buildQuery(model, filter) {
    const {where, limit, skip, fields} = filter;
    let {order} = filter;

    let query = this.db.createQuery(model);

    if (where) {
      for (const key in where) {
        if (where.hasOwnProperty(key)) {
          const value = {[key]: where[key]};
          query = this.addFiltersToQuery(query, value);
        }
      }
    }

    if (order) {
      if (!Array.isArray(order)) {
        order = [order];
      }
      order.forEach(element => {
        const option = element.split(' ');
        if (option[1].toUpperCase() === 'DESC') {
          query = query.order(option[0], {descending: true});
        } else {
          query = query.order(option[0]);
        }
      });
    }

    if (limit) {
      query = query.limit(limit);
    }

    if (skip) {
      query = query.offset(skip);
    }

    if (fields) {
      const selects = fields.filter(field => field === true);

      query = query.select(selects);
    }
    return query;
  }

  /**
   * Add new filter to a Query
   * @param {Query} query Datastore Query
   * @param {Object} filter The filter object
   */
  addFiltersToQuery(query, filter) {
    const key = Object.keys(filter)[0];
    const value = Object.values(filter)[0];

    const isObject = typeof value === 'object';

    if (isObject) {
      return this.addInnerFiltersToQuery(query, key, value);
    }

    return query.filter(key, '=', value);
  }

  /**
   * Add inner filters to a Query
   * @param {Query} query Datastore Query
   * @param {String} key Property name being filtered
   * @param {Object} value Object with operator and comparison value
   */
  addInnerFiltersToQuery(query, key, value) {
    let resultQuery = query;

    for (const operation in value) {
      if (value.hasOwnProperty(operation)) {
        const comparison = value[operation];
        let operator = undefined;
        switch (operation) {
          case 'lt':
            operator = '<';
            break;
          case 'lte':
            operator = '<=';
            break;
          case 'gt':
            operator = '>';
            break;
          case 'gte':
            operator = '>=';
            break;
          case 'ne':
            operator = '!=';
            break;
          case 'in':
            operator = 'in';
            break;
          default:
            break;
        }
        resultQuery = resultQuery.filter(key, operator, comparison);
      }
    }

    return resultQuery;
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

      let entities = await this.findById(model, id);
      const foundEntity = entities[0] !== undefined;

      if (!foundEntity) {
        entities = await this.addOrUpdateEntity(model, newData);
      }

      callback(null, entities);
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
      const result = await this.updateInternal(model, id, data);

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
      const entities = await this.findById(model, id);
      const foundEntity = entities.length > 0;

      if (!foundEntity) throw new Error('Entity not found');

      const entity = entities[0];
      const newData = Object.assign(entity, data);

      await this.addOrUpdateEntity(model, newData, 'update');

      return Promise.resolve(newData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update matching Entity
   * @param {String} model The model name
   * @param {Object} filter The filter object
   * @param {Object} data The property/value pairs to be updated
   * @param {Object} options The options object
   * @param {Function} callback The callback function
   */
  async update(model, filter, data, options, callback) {
    try {
      const {where} = filter;

      let result;

      if (where && where.id) {
        result = await this.updateInternal(model, where.id, data);
      } else {
        const entities = await this.getResultsWithQuery(model, filter);

        const newEntities = entities.map(entity => {
          return Object.assign(entity, data);
        });

        await this.db.update(newEntities);

        result = newEntities;
      }
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
   */
  async deleteData(model, id) {
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
        const {db} = this;

        const keys = result.map(entity => {
          return db.key([model, Number.parseInt(entity.id)]);
        });

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

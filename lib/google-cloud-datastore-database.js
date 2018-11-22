/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
/* eslint-disable no-use-before-define */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-underscore-dangle */
/* eslint-disable consistent-return */
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
    return data.id ? this.db.key([model, data.id]) : this.db.key(model);
  }

  /**
   * Create a new Entity
   * @param {Object} obj The property/value pairs to be created
   * @param {String} key The id value for this document
   */
  createEntity(obj, key) {
    const data = Object.assign(obj, { id: key.name });
    return { data, key };
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
      } else {
        result = await this.db.upsert(entity);
      }

      const id = result[0].mutationResults[0].key.path[0].id;
      const newData = Object.assign(data, { id });

      return Promise.resolve(newData);
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
   * Find matchin model Entity by the id
   * @param {String} model The model name
   * @param {String} id The Entity id
   */
  async findById(model, id) {
    try {
      const key = this.db.key([model, id]);
      const result = await this.db.get(key);

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

      const result = await query.run();

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
      if (where && where.id) {
        const result = await this.findById(model, where.id);

        callback(null, result);
      } else if (where) {
        const query = this.buildQuery(model, where);

        const result = await query.run();

        callback(null, result[0]);
      } else {
        const result = await this.getAllEntity(model);

        callback(null, result[0]);
      }
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
    const filters = Object.keys(where).map(key => ({ [key]: where[key] }));

    let query = this.db.createQuery(model);

    for (let i = 0; i < filters.length; i += 1) {
      query = this.addFilterToQuery(query, filter[i]);
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
        const key = this.db.key([model, where.id]);
        const result = await this.db.get(key);

        callback(null, result.length);
      } else {
        const result = await this.getAllEntity(model);

        callback(null, result[0].length);
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
    const key = this.db.key([model, id]);

    try {
      const result = await this.db.get(key);

      if (result.length > 0) callback(null, true);
      else callback(null, false);
    } catch (error) {
      callback(error);
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
      const find = await this.findById(model, data.id);

      if (find.length > 0) {
        callback(null, find);
      } else {
        const result = await this.addOrUpdateEntity(model, data);

        callback(null, result);
      }
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
      if (!this.exists(model, id)) throw new Error('Entity not found');

      await this.addOrUpdateEntity(model, data, 'update');

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

    const key = this.db.key([model, id]);

    try {
      if (!this.exists(model, id)) throw new Error('Entity not found');

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

        const entities = result[0].map((entity) => {
          const key = this.db.key([model, entity.id]);
          return this.createEntity(entity, key);
        });

        await this.db.delete(entities);
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
      const result = await this.deleteData(model, entityId, null);

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }
}

util.inherits(GoogleCloudDatastore, Connector);
exports.RealtimeDatabase = GoogleCloudDatastore;

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
   * Create new model Entity
   * @param {String} model The model name
   * @param {Object} data The property/value pairs to be created
   * @param {Object} options The options object
   * @param {Function} [cb] The callback function
   */
  async create(model, data, options, callback) {
    try {
      const key = this.createEntityKey(model, data);
      const entity = this.createEntity(data, key);

      const result = await this.db.insert(entity);

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  // /**
  //  * Find matching model instances by the filter
  //  * @param {String} model The model name
  //  * @param {Object} filter The filter
  //  * @param {Object} options The options object
  //  * @param {Function} callback The callback function
  //  */
  // async all(model, filter, options, callback) {
  //   const entity = this.db.createQuery(model);
  // }

  /**
   * Add new filter to a Query
   * @param {Query} query Datastore Query
   * @param {Object} filter The filter object
   */
  addFilterToQuery(query, filter) {
    return query.filter(Object.values(filter));
  }

  /**
   * Count the number of Entities of a model
   * @param {String} model The model name
   * @param {Object} where The filter object
   * @param {Object} options The options object
   * @param {Function} callback The callback function
   */
  async count(model, where, options, callback) {
    const fileId = where ? where.id : undefined;

    try {
      if (fileId) {
        const key = this.db.key([model, fileId]);
        const result = await this.db.get(key);

        callback(null, result.length);
      } else {
        const query = this.db.createQuery(model);

        const result = await query.run();

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
    const key = this.db.key([model, fileId]);

    try {
      const result = await this.db.get(key);

      if (result.length > 0) callback(null, true);
      else callback(null, false);
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

    if (!this.exists(model, id)) throw new Error('Entity not found');

    try {
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
    const entityId = where ? where.id : undefined;

    try {
      if (instanceId) {
        const result = await this.deleteData(model, entityId, null);

        callback(null, result);
      } else {
        const query = this.db.createQuery(model);

        const result = await query.run();

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

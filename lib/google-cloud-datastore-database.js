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
   * Create new model instance
   * @param {String} model The model name
   * @param {Object} data The property/value pairs to be created
   * @param {Object} options The options object
   * @param {Function} [cb] The callback function
   */
  async create(model, data, options, callback) {
    try {
      const key = this.db.key(model);
      const entity = { data, key };

      const result = await this.db.insert(entity).catch((error) => {
        throw error;
      });

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }
}

util.inherits(GoogleCloudDatastore, Connector);
exports.RealtimeDatabase = GoogleCloudDatastore;

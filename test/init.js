require('dotenv').config();
module.exports = require('should');

const DataSource = require('loopback-datasource-juggler').DataSource;

try {
  const config = {
    projectId: process.env.projectId,
    keyFilename: process.env.keyFilename,
  };

  global.config = config;

  global.getDataSource = global.getSchema = () => {
    const db = new DataSource(require('../'), config);
    db.log = (a) => {
      console.log(a);
    };

    return db;
  };
} catch (error) {
  console.error('Init test error: ', error);
}

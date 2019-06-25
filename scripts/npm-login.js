require('dotenv').config();
const npmLogin = require('npm-cli-login');

const {NPM_USER, NPM_PASS, NPM_EMAIL} = process.env;

npmLogin(NPM_USER, NPM_PASS, NPM_EMAIL);

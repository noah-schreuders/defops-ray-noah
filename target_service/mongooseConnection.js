var mongoose = require('mongoose');

require('dotenv').config();
require('./models/target');

mongoose.connect(process.env.TARGET_SERVICE_DB_CONNECTION);
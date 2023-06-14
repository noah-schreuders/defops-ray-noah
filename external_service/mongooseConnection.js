var mongoose = require('mongoose');

require('dotenv').config();
require('./models/tag');

mongoose.connect(process.env.EXTERNAL_SERVICE_DB_CONNECTION);
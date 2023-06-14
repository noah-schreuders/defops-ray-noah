var mongoose = require('mongoose');

require('dotenv').config();
require('./models/user');

mongoose.connect(process.env.AUTHENTICATION_SERVICE_DB_CONNECTION);
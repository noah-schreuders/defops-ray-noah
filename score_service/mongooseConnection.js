var mongoose = require('mongoose');

require('dotenv').config();
require('./models/score');

mongoose.connect(process.env.SCORE_SERVICE_DB_CONNECTION);
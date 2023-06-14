const mongoose = require('mongoose');
const scoreSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    targetname: {
        type: String,
        required: true
    },
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 1000
    }
});

mongoose.model('Score', scoreSchema);
module.exports = mongoose.model('Score');
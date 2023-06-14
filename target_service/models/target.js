const mongoose = require('mongoose');
const targetSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    placename: {
        type: String,
        required: true
    },
    image: {
        data: {
            type: Buffer,
            required: true
        },
        contentType: {
            type: String,
            required: true
        }
    },
    username: {
        type: String,
        required: true
    }
});

mongoose.model('Target', targetSchema);
module.exports = mongoose.model('Target');
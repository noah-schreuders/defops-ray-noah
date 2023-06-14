const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
    },
    role: {
        type: String,
        required: true
    },
    score: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    }
});

mongoose.model('User', userSchema);
module.exports = mongoose.model('User');
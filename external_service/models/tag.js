const mongoose = require('mongoose');
const { Schema } = mongoose;
const tagSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    targetname: {
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
    // score: {
    //     type: Schema.Types.ObjectId,
    //     ref: 'Score',
    //     required: true
    // }
    score: {
        type: Number,
        required: true
    }
});

mongoose.model('Tag', tagSchema);
module.exports = mongoose.model('Tag');
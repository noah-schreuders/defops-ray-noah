require('dotenv').config();
require('./mongooseConnection');
const axios = require('axios');
const { connect, getChannel } = require('./rabbitmq_connection');
const port = process.env.EXTERNAL_SERVICE_PORT || 3004;
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const db = mongoose.connection;
const formdata = require('form-data');
const fs = require('fs');
const Tag = require('./models/tag');
const { hasOpaqueToken } = require('../middleware/auth');
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "./public/data/uploads/");
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({storage: storage});

app.use(express.json());

let connection;
let channel;

const createRabbitMQConnection = async () => {
  try {
    connection = await connect();
    channel = await getChannel();
    console.log('RabbitMQ connection established for external service');
  } catch (error) {
    console.log(`Error establishing RabbitMQ connection for external service: ${error}`);
  }
};

app.post('/tag', hasOpaqueToken ,upload.single('image'), async(req, res) => {
  const {username, targetname} = req.body;
    const image = req.file.path;

    if (req.file.mimetype !== "image/png" && req.file.mimetype !== "image/jpeg" && req.file.mimetype !== "image/jpg") {
        return res.status(400).json({ message: "The upload must be a PNG or JPG file" });
    }

  const apiForm = new formdata();
  apiForm.append('image', fs.createReadStream(image));

  const apiKey = 'acc_223de788208e807';
  const apiSecret = 'e7f4fce5e11cca29c9881eb79606f369';

  const options = {
    method: 'POST',
    url: 'https://api.imagga.com/v2/tags',
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`, 'utf8').toString('base64')}`,
      ...apiForm.getHeaders()
    },
    data: apiForm
  };

  try {
      const response = await axios(options);
      let totalScore = 0;

      response.data.result.tags.forEach(element => {
        totalScore += element.confidence;
      });

      const tag = await db.collection("tags");
      const newTag = {
        username: username,
        targetname: targetname,
        image: image,
        score: totalScore,
      };
      tag.insertOne(newTag);

      // Declare queue
      const queue = 'tag_created';
      await channel.assertQueue(queue, { durable: false });

      // Send message to queue
      channel.sendToQueue(queue, Buffer.from(JSON.stringify(newTag)));
      console.log(`Message sent to queue ${queue}`);
      return res.json({ message: "Tag created" });
  } catch (error) {
      console.log(error.response.data);
  };
});

app.post('/score/:targetname', hasOpaqueToken, async(req, res) => {
  const targetname = req.params.targetname;
  const targetFound = await Tag.findOne({targetname: targetname});

  if(targetFound != null) {
    return res.json({message: "Ok", score: targetFound.score});
  } else {
     res.status(404).json({message: "Score for target not found"});
  }
});

app.listen(port, () => {
  console.log(`External service listening on port ${port}`);
  const queue = 'score_request';

  const publishScore = async (channel, score) => {
    const exchange = 'score_exchange';
    await channel.assertExchange(exchange, 'direct', { durable: false });
    const message = JSON.stringify(score);
    channel.publish(exchange, '', Buffer.from(message));
  };
  
  const consumeMessage = async (channel) => {
    await channel.assertQueue(queue, { durable: false });
    console.log(`Listening to queue ${queue}`);
  
    channel.consume(queue, async (message) => {
      const { targetname } = JSON.parse(message.content.toString());
      console.log(`Received message from queue, targetName: ${targetname}`);
  
      try {
        const tags = await Tag.find({ targetname });
        console.log(tags);
        if (tags.length > 0) {
          console.log(`Scores for target: ${targetname}`);
          tags.forEach(async (tag) => {
            const score = { targetname, username: tag.username, score: tag.score };
            await publishScore(channel, score);
            console.log(`Score: ${tag.score} by user: ${tag.username}`);
          });
        } else {
          console.log(`Score for target ${targetname} not found`);
        }
      } catch (error) {
        console.log(`Error finding scores for target ${targetname}: ${error}`);
      }
  
    }, { noAck: true });
  };
  
  createRabbitMQConnection()
    .then(() => consumeMessage(channel))
    .catch((error) => console.log(`CError connecting to RabbitMQ: ${error}`));
});

require('dotenv').config();
require('./mongooseConnection');

const port = process.env.TARGET_SERVICE_PORT || 3001;
const { connect, getChannel } = require('../rabbitmq_connection');
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const db = mongoose.connection;
const multer = require('multer');
const { hasOpaqueToken } = require('../middleware/auth');
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
    await channel.assertQueue('username_request', { durable: false });
    await channel.assertQueue('username_result', { durable: false });
    console.log('RabbitMQ connection established for target service');
  } catch (error) {
    console.log(`Error establishing RabbitMQ connection for target service: ${error}`);
  }
};

app.post('/target', hasOpaqueToken ,upload.single("image"), async (req, res) => {
    const { name, placename } = req.body;
    const username = req.headers.username;
    const image = req.file.path;

    if (!name || !placename || !image || !username) {
        return res.status(400).json({ message: "All fields are required." });
    }

    if (req.file.mimetype !== "image/png" && req.file.mimetype !== "image/jpeg" && req.file.mimetype !== "image/jpg") {
        return res.status(400).json({ message: "The upload must be a PNG or JPG file" });
    }

    const target = await db.collection("targets");
    const findTarget = await target.findOne({ name: name});
    if (findTarget) {
        return res.status(409).json({ message: "Target already exists." });
    }

    try {
        // Send message to username_request queue using the existing channel
        const exchange = 'username_exchange';
        const routingKey = 'username_request';
    
        channel.assertExchange(exchange, 'direct', { durable: true });
        channel.bindQueue('username_request', exchange, routingKey);
    
        const message = JSON.stringify({ name, placename, image, username });
        channel.publish(exchange, routingKey, Buffer.from(message));
        console.log(`Sent message with name=${name}, placename=${placename}, image=${image}, username=${username}`);
    
        const newTarget = {
          name: name,
          placename: placename,
          image: image,
          username: username,
        };
        target.insertOne(newTarget);
        return res.json({ message: "Target created" });
      } catch (error) {
        console.log(`Error sending target message: ${error}`);
        return res.status(500).json({ message: 'Internal server error' });
      }
});


app.get('/targets/:fieldName/:fieldValue', hasOpaqueToken, async (req, res) => {
    try {
        const fieldName = req.params.fieldName;
        const fieldValue = req.params.fieldValue;
        const query = {};
        query[fieldName] = fieldValue;
        const target = await db.collection("targets");

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;

        const cursor = await target.find(query)
            .skip((page - 1) * pageSize)
            .limit(pageSize);

        const result = await cursor.toArray();

        // Total count of targets
        const totalCount = await target.countDocuments(query);

        // Check if result is an empty array
        if (result.length === 0) {
            return res.status(404).json({ message: 'Not found' });
        } else {
            return res.json({
                data: result,
                pagination: {
                    page: page,
                    pageSize: pageSize,
                    totalCount: totalCount,
                }
            });
        }
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/targets', hasOpaqueToken, async (req, res) => {
    try {
        const target = await db.collection("targets");

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 1;

        const totalCount = await target.countDocuments();

        const cursor = await target.find()
            .skip((page - 1) * pageSize)
            .limit(pageSize);

        const result = await cursor.toArray();

        // Check if result is an empty array
        if (result.length === 0) {
            return res.status(404).json({ message: 'Not found' });
        } else {
            return res.json({
                data: result,
                pagination: {
                    page: page,
                    pageSize: pageSize,
                    totalCount: totalCount,
                }
            });
        }
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

app.delete('/targets/:name', hasOpaqueToken, async (req, res) => {
    try {
        const name = req.params.name;
        const target = await db.collection("targets");
        const foundTarget = await target.findOne(name);

        if (foundTarget) {
            if (target.username === req.user.username) {
                target.deleteOne(name);
                return res.status(204).json({ message: "No content" });
            } else {
                return res.status(401).json({message: "Unauthorized"});
            }
        } else {
            return res.status(404).json({message: "Not found"});
        }
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({message: "Internal server error"});
    }
});

app.listen(port, () => {
    console.log(`Target service listening on port ${port}`);

  const consumeMessage = async (channel) => {
    const queue = 'username_result';
    await channel.assertQueue(queue, { durable: false });
    channel.consume(queue, async (message) => {
      const { username } = JSON.parse(message.content.toString());
      console.log(`Consumed message with username=${username}`);
    }, { noAck: true });
  };

  createRabbitMQConnection()
    .then(() => consumeMessage(channel))
    .catch((error) => console.log(`Error connecting to RabbitMQ: ${error}`));
});
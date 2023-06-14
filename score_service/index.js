require('dotenv').config();
require('./mongooseConnection');
const port = process.env.SCORE_SERVICE_PORT || 3003;
const { connect, getChannel } = require('../rabbitmq_connection');
const express = require('express');
const app = express();
const { hasOpaqueToken } = require('../middleware/auth');

app.use(express.json());

let connection;
let channel;

const createRabbitMQConnection = async () => {
  try {
    connection = await connect();
    channel = await getChannel();
    console.log('RabbitMQ connection established for score service');
  } catch (error) {
    console.log(`Error establishing RabbitMQ connection for score service: ${error}`);
  }
};

createRabbitMQConnection();

app.post('/score/:targetname', hasOpaqueToken, async(req, res) => {
  const targetname = req.params.targetname;
  const queue = 'score_request';
  await channel.assertQueue(queue, { durable: false });

  const message = { targetname };
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));

  console.log(`Message sent to queue ${queue}`);
});

app.post('/myscore/:targetname', hasOpaqueToken, async (req, res) => {
  const targetname = req.params.targetname;
  const queue = 'username_request';
  await channel.assertQueue(queue, { durable: false });

  // Send a message to the queue requesting the username for the given targetname
  const message = { targetname };
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
  console.log(`Message sent to queue ${queue}`);

  // Consume the response queue to get the username
  const responseQueue = await channel.assertQueue('', { exclusive: true });
  const correlationId = generateUuid();

  await channel.consume(responseQueue.queue, (msg) => {
    if (msg.properties.correlationId === correlationId) {
      const username = JSON.parse(msg.content.toString()).username;
      console.log(`Received username ${username}`);
      
      // Send the response with the score
      res.status(200).json({ message: 'Ok' });
    }
  }, { noAck: true });

  // Send a message to the queue requesting the username for the given targetname
  const requestMessage = { targetname, correlationId, replyTo: responseQueue.queue };
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(requestMessage)), {
    correlationId,
    replyTo: responseQueue.queue
  });
});

function generateUuid() {
  return Math.random().toString() +
         Math.random().toString() +
         Math.random().toString();
}

app.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});
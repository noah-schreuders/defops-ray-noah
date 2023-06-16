const amqp = require('amqplib/');
let connection = null;

async function connect() {
  try {
    connection = await amqp.connect('amqp://localhost:5672');
    return connection;
  } catch (error) {
    console.log(error);
  }
}

async function getChannel() {
  try {
    if (connection === null) {
      await connect();
    }
    const channel = await connection.createChannel();
    return channel;
  } catch (error) {
    console.log(error);
  }
}

async function connectQueue(queueName) {
  try {
    const channel = await getChannel();
    await channel.assertQueue(queueName);
  } catch (error) {
      console.log(error)
  }
}

module.exports = { connect, getChannel, connectQueue };

require('dotenv').config();
require('./mongooseConnection');

const port = process.env.AUTHENTICATION_SERVICE_PORT || 3002;
const { connect, getChannel } = require('../rabbitmq_connection');
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const db = mongoose.connection;
const jwt = require('jsonwebtoken');
const jwtPassport = require('passport-jwt');
const bcrypt = require('bcrypt');
const extractJWT = jwtPassport.ExtractJwt;
const jwtOptions = {jwtFromRequest: extractJWT.fromAuthHeaderAsBearerToken(), secretOrKey: process.env.JWT_SECRET};
const User = require('./models/user');
const amqp = require('amqplib');
const axios = require('axios');
const { hasOpaqueToken } = require('../middleware/auth');

app.use(express.json());

let connection;
let channel;

const createRabbitMQConnection = async () => {
  try {
    connection = await connect();
    channel = await getChannel();
    console.log('RabbitMQ connection established for authentication service');
  } catch (error) {
    console.log(`Error establishing RabbitMQ connection for authentication service: ${error}`);
  }
};

app.post('/login', async (req, res) => {
  const {username, password} = req.body;
  const userFound = await User.findOne({username: username});

  if(userFound != null && await bcrypt.compare(password, userFound.password)) {
    var payload = {uid: userFound.uid, username: userFound.username, role: userFound.role};
    var authToken = jwt.sign(payload, jwtOptions.secretOrKey, {expiresIn: 604800});
    return res.json({message: "Ok", token: authToken});
  } else {
     res.status(401).json({message: "Username or password is invalid"});
  }
});

app.post('/register', async (req, res) => {
  const user = await db.collection("users");
  const { username, password, email, role} = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required."});
  }
  const findUser = await db.collection("users").findOne({ username });
    
  if (findUser) {
    return res.status(400).json({ message: "Username already exists." });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const newUser = new User({
            username,
            hashedPassword,
            email,
            role
        });

        await newUser.save();

        return res.json({ message: "User created" });
    } catch (error) {
        if (error instanceof mongoose.Error.ValidationError) {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: "Validation failed", errors: validationErrors });
        }
        return res.status(500).json({ message: "An error occurred while creating the user." });
    }
});

app.get('/getuser', hasOpaqueToken ,async (req, res) => {
  const username = req.headers.username;
    if (username) {
        return res.json(username);
    } else {
        return res.status(404).send('No user found');
    }
});

app.listen(port, async () => {
  console.log(`User service listening on port ${port}`);

  const consume = async (channel) => {
    const queue = 'username_request';
    await channel.assertQueue(queue, { durable: false });
  
    console.log(`Waiting for messages in queue ${queue}`);
  
    channel.consume(queue, async (message) => {
      const { name, username } = JSON.parse(message.content.toString());
      console.log(`Received message with targetname=${name} and username=${username}`);
  
      const exchange = 'username_exchange';
      channel.assertExchange(exchange, 'direct', { durable: true });
      // channel.publish(exchange, '', Buffer.from(JSON.stringify({ username: username })));
      console.log(`Sent message with username=${username}`);
  
      channel.ack(message);
    });
  };

  createRabbitMQConnection()
        .then(() => consume(channel))
        .catch((error) => console.log(`Error connecting to RabbitMQ: ${error}`));

});




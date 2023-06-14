const { mockRequest, mockResponse } = require('jest-mock-req-res');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');   
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const jwtPassport = require('passport-jwt');
const extractJWT = jwtPassport.ExtractJwt;



beforeAll(async () => {
    memServer = await MongoMemoryServer.create();
    const uri = memServer.getUri();
    await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    db = mongoose.connection;
});

afterAll(async () => {
    await mongoose.connection.close();
    await memServer.stop();
})

beforeEach(async () => {
    await db.collection('users').deleteMany({}); // Clear targets collection before each test
});

async function login(req, res) {
    const { username, password } = req.body;
    const userFound = await db.collection('users').findOne({ username: username });
    const jwtOptions = {
        secretOrKey: 'secrettests',
        expiresIn: 604800,
    };

    if (userFound != null && await bcrypt.compare(password, userFound.password)) {
        var payload = { uid: userFound.uid, username: userFound.username, role: userFound.role };
        var authToken = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: 604800 });
        return res.json({ message: "Ok", token: authToken });
    } else {
        res.status(401).json({ message: "Username or password is invalid" });
    }
}

async function register(req, res) {
    const user = await db.collection("users");
    const { username, password, email, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }
    const findUser = await db.collection("users").findOne({ username });

    if (findUser) {
        return res.status(400).json({ message: "Username already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        username: username,
        password: hashedPassword,
        email: email,
        role: role
    };
    await user.insertOne(newUser);
    return res.json({ message: "User created" });
}

describe('Authentication', () => {
    describe('Login', () => {
        it('should return an error if username or password is invalid', async () => {
            const req = mockRequest({
                body: {
                    username: 'invalidUser',
                    password: 'invalidPassword',
                },
            });
            const res = mockResponse();

            await login(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: 'Username or password is invalid' });
        });

        it('should return an authentication token if username and password are valid', async () => {
            const validUser = {
                username: 'testuser',
                password: await bcrypt.hash('testpassword', 10),
                email: "test@test.com",
                role: "Beheerder"
            };
            await db.collection('users').insertOne(validUser);

            const req = mockRequest({
                body: {
                    username: 'testuser',
                    password: 'testpassword',
                },
            });
            const res = mockResponse();

            await login(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Ok', token: expect.any(String) }));
        });
    });

    describe('Registration', () => {
        it('should return an error if username or password is missing', async () => {
            const req = mockRequest({
                body: {
                    username: '',
                    password: 'testpassword',
                },
            });
            const res = mockResponse();

            await register(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Username and password are required.' });
        });

        it('should return an error if the username already exists', async () => {
            // Mock an existing user in the database
            const existingUser = {
                username: 'existinguser',
                password: await bcrypt.hash('testpassword', 10),

            };
            await db.collection('users').insertOne(existingUser);

            const req = mockRequest({
                body: {
                    username: 'existinguser',
                    password: 'testpassword',
                    email: 'test@test.com',
                    role: 'user',
                },
            });
            const res = mockResponse();

            await register(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Username already exists.' });
        });

        it('should create a new user if all fields are provided correctly', async () => {
            const req = mockRequest({
                body: {
                    username: 'newuser',
                    password: 'testpassword',
                    email: 'test@test.com',
                    role: 'Beheerder',
                },
            });
            const res = mockResponse();

            await register(req, res);

            expect(res.json).toHaveBeenCalledWith({ message: 'User created' });
        });
    });
});

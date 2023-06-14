const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { mockRequest, mockResponse } = require('jest-mock-req-res');

let memServer;
let db;


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


async function createTarget(req, res, db) {
    const { name, placename } = req.body;
    const username = req.headers.username;
    const image = req.file.path;

    if (!name || !placename || !image || !username) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    if (
        req.file.mimetype !== 'image/png' &&
        req.file.mimetype !== 'image/jpeg' &&
        req.file.mimetype !== 'image/jpg'
    ) {
        return res.status(400).json({ message: 'The upload must be a PNG or JPG file' });
    }

    const target = await db.collection('targets');
    const findTarget = await target.findOne({ name: name });
    if (findTarget) {
        return res.status(409).json({ message: 'Target already exists.' });
    }

    // Perform any necessary operations with the database, such as inserting the new target
    await target.insertOne({
        name: name,
        placename: placename,
        image: image,
        username: username,
    });

    return res.json({ message: 'Target created' });
}

module.exports = {
    createTarget,
};


describe('targetCreation', () => {
    it('should return an error if a non-image file is uploaded', async () => {
        const req = mockRequest({
            body: {
                name: 'Test Target',
                placename: 'Test Placename',
            },
            headers: {
                username: 'testuser',
            },
            file: {
                path: 'test/path.txt',
                mimetype: 'text/plain',
            },
        });
        const res = mockResponse();

        await createTarget(req, res, db);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'The upload must be a PNG or JPG file' });
    });

    it('should add target to the db', async () => {
        const req = mockRequest({
            body: {
                name: 'Test Target',
                placename: 'Test Placename',
            },
            headers: {
                username: 'testuser',
            },
            file: {
                path: 'test/path.png',
                mimetype: 'image/png',
            },
        });
        const res = mockResponse();

        await createTarget(req, res, db);

        const target = await db.collection('targets').findOne({ name: 'Test Target' });
        expect(target).toBeDefined();
        expect(target.name).toBe('Test Target');
        expect(target.placename).toBe('Test Placename');
        expect(target.username).toBe('testuser');
    });
});

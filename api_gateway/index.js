const express = require('express');
const app = express();
const axios = require('axios');
const multer = require('multer');
const upload = multer()
const bodyParser = require('body-parser');
const formdata = require('form-data');
const fs = require('fs');
const {isAuthorized, hasRole } = require('./middleware/auth');

const port = process.env.API_GATE_PORT || 3000;

const targetService = process.env.TARGET_SERVICE_URL || 'http://127.0.0.1:3001';
const authenticationService = process.env.AUTHENTICATION_SERVICE_URL || 'http://127.0.0.1:3002';
const scoreService = process.env.SCORE_SERVICE_URL || 'http://127.0.0.1:3003';
const externalService = process.env.EXTERNAL_SERVICE_URL || 'http://127.0.0.1:3004';

const promBundle = require('express-prom-bundle');
const metricsMiddleware = promBundle({includePath: true, includeStatusCode: true, promClient: {collectDefaultMetrics: {}}});

require ('dotenv').config();

app.use(metricsMiddleware);
app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb"}));

app.post('/login', async(req, res) => {
    try {
        const response = await axios.post(authenticationService + '/login', req.body, {
            headers: {
                opaque_token: process.env.OPAQUE_CODE
            }
        });
        return res.json(response.data);
        } catch (error) {
            res.send(error.response.data);
        }
});

app.post('/register', async(req, res) => {
    try {
        const response = await axios.post(authenticationService + '/register', req.body, {
            headers: {
                opaque_token: process.env.OPAQUE_CODE
            }
        });
        return res.json(response.data);
        } catch (error) {
            res.send(error.response.data);
        }
});

app.get('/getuser', isAuthorized, hasRole(["Beheerder", "Gebruiker"]), async(req, res) => {
    try {
        const response = await axios.get(authenticationService + '/getuser', {
            headers: {
                username: req.user.username,
                opaque_token: process.env.OPAQUE_CODE
            }
        });
        return res.json(response.data);
        } catch (error) {
            res.send(error.response.data);
        }
});

app.post('/tag', upload.single("image"), isAuthorized, hasRole(["Beheerder", "Gebruiker"]), async(req, res) => {
  try {
    const form = new formdata();
    form.append('username', req.body.username);
    form.append('targetname', req.body.targetname);
    form.append('image', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
    });

      const response = await axios.post(externalService + '/tag', form, {
          headers: {
              opaque_token: process.env.OPAQUE_CODE
          }
      });
    return res.json(response.data);
    } catch (error) {
        res.send(error.response?.data || error);
    }
});

app.post('/score/:targetname', isAuthorized, hasRole(["Beheerder", "Gebruiker"]), async(req, res) => {
    try {
        const response = await axios.post(scoreService + '/score/' + req.params.targetname, null, {
            headers: {
                opaque_token: process.env.OPAQUE_CODE
            }
        });
        return res.json(response.data);
        } catch (error) {
            res.send(error.response.data);
        }
});

app.post('/myscore/:targetname', isAuthorized, hasRole(["Beheerder", "Gebruiker"]), async(req, res) => {
    try {
        const response = await axios.post(scoreService + '/myscore/' + req.params.targetname, {
            headers: {
                opaque_token: process.env.OPAQUE_CODE
            }
        });
        return res.json(response.data);
        } catch (error) {
            res.send(error.response.data);
        }
});

app.post('/targets', upload.single("image"), isAuthorized, hasRole(["Beheerder"]), async(req, res) => {
    try {
        const form = new formdata();
        form.append('name', req.body.name);
        form.append('username', req.body.username);
        form.append('placename', req.body.placename);
        form.append('image', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        const response = await axios.post(targetService + '/target', form,
            {
                headers: {
                    username: req.user.username,
                    opaque_token: process.env.OPAQUE_CODE
                }
            });
        return res.json(response.data);
        } catch (error) {
            res.send(error.response?.data || error);
        }
});

app.get('/targets', isAuthorized, hasRole(["Beheerder", "Gebruiker"]), async (req, res) => {
    try {
        const params = {
            ...req.query, // Include query string parameters
            ...req.body,  // Include request body
        };

        const response = await axios.get(targetService + '/targets', {
            params: params,
            headers: {
                opaque_token: process.env.OPAQUE_CODE
            }
        });
        return res.json(response.data);
    } catch (error) {
        res.send(error.response.data);
    }
});

app.get('/targets/:fieldName/:fieldValue', isAuthorized, hasRole(["Beheerder", "Gebruiker"]), async(req, res) => {
    try {
        const response = await axios.get(targetService + '/targets/' + req.params.fieldName + "/" + req.params.fieldValue, req.body, {
            headers: {
                opaque_token: process.env.OPAQUE_CODE
            }
        });
        return res.json(response.data);
        } catch (error) {
            res.send(error.response.data);
        }
});

app.get('/targets/:name', isAuthorized, hasRole(["Beheerder"]), async(req, res) => {
    try {
        const response = await axios.get(targetService + '/targets/' + req.params.name, req.body, {
            headers: {
                opaque_token: process.env.OPAQUE_CODE
            }
        });
        return res.json(response.data);
        } catch (error) {
            res.send(error.response.data);
        }
});

app.listen(port, () => {
    console.log(`API Gateway listening on port ${port}`);
});

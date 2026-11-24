const express = require('express');
const router = express.Router();
const loginControllers = require('../controllers/loginControllers');
const verifyCaptcha = require('../middlewares/verifyCaptcha');

router.post('/login', verifyCaptcha, loginControllers.login);

module.exports = router;
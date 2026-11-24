const express = require('express');
const router = express.Router();
const { getUserById, register, getAllUsers, deleteUser, updateUser, login, restoreUser, cambiarPassword, cambiarPasswordAdmin } = require('../controllers/altaUserControllers');

router.post('/register', register);
router.get('/usuarios/:id', getUserById);
router.post('/login', login);
router.get('/usuarios', getAllUsers);
router.delete('/usuarios/:id', deleteUser);     
router.put('/usuarios/:id', updateUser);
router.put('/usuarios/restore/:id', restoreUser);  
router.put('/usuarios/:id/cambiar-password', cambiarPassword);
router.put('/usuarios/password/:id', cambiarPasswordAdmin);

module.exports = router;
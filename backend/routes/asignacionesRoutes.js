const express = require('express');
const router = express.Router();
const asignacionController = require('../controllers/asignacionesControllers');

router.post('/asignar-efectores', asignacionController.asignarEfectores);
router.get('/asignaciones/:idUsuario', asignacionController.obtenerEfectoresPorAuditor);// opcional
router.get('/asignaciones', asignacionController.obtenerTodasAsignaciones);
router.delete('/asignaciones/:idUsuario', asignacionController.eliminarAsignacion);
router.get('/asignaciones-sin-auditoria/:idUsuario', asignacionController.ObtenerAsignacionesSinAuditoria);
router.get('/auditorias-en-progreso/:idUsuario', asignacionController.obtenerAuditoriasEnProgreso);
router.put('/asignaciones/reasignar', asignacionController.reasignarAuditor);


module.exports = router;

const reportesModels = require('../models/reportesModels');

exports.listaPracticasConDebito = (req, res) => {
  // Capturamos el módulo que llega por query string desde el frontend
  const filtros = {
    modulo: req.query.modulo
  };

  reportesModels.getAll(filtros, (err, data) => {
    if (err) {
      res.status(500).send('Error al obtener el resumen de practicas con debitos');
    } else {
      res.json(data);
    }
  });
};
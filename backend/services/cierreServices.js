const Cierre  = require('../models/cierreModels');

const crearCierreConDetalle = (idEfector, periodo, idUsuario) => {
  return new Promise((resolve, reject) => {
    Cierre.crearCierre(idEfector, periodo, idUsuario, (err, idCierre) => {
      if (err) return reject(err);

      Cierre.guardarDetalle(idCierre, idEfector, periodo, (err2, result) => {
        if (err2) return reject(err2);

        resolve({ idCierre });
      });
    });
  });
};

// Nueva función añadida en el servicio para soportar el cierre masivo
const crearCierreMasivo = async (periodo, efectoresIds, idUsuario) => {
  try {
    const cierresGenerados = await Cierre.crearCierreMasivo(periodo, efectoresIds, idUsuario);
    return cierresGenerados;
  } catch (error) {
    throw error;
  }
};

const listarCierres = (callback) => {
  Cierre.listarCierres(callback);
};

// Modificado para invocar al modelo en lugar de usar db.query directo aquí
const obtenerDetalleCierrePorId = (idcierre) => {
  return new Promise((resolve, reject) => {
    Cierre.obtenerDetalleCierrePorId(idcierre, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

module.exports = { crearCierreConDetalle, listarCierres, crearCierreMasivo, obtenerDetalleCierrePorId };
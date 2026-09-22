// controllers/cierreController.js
const CierreService = require('../services/cierreServices');

const crearCierre = async (req, res) => {
  try {
    const { idEfector, periodo, idUsuario } = req.body;

    // Validar que estén todos los datos
    if (!idEfector || !periodo || !idUsuario) {
      return res.status(400).json({ error: 'Faltan datos requeridos: idEfector, periodo, idUsuario' });
    }

    // Llamar al servicio que devuelve promesa
    const cierre = await CierreService.crearCierreConDetalle(idEfector, periodo, idUsuario);

    res.status(201).json({ message: 'Cierre creado correctamente', cierre });
  } catch (err) {
    console.error('Error en crearCierre:', err);
    res.status(500).json({ error: 'Error al crear el cierre' });
  }
};

const efectoresConCierre = (req, res) => {
  const { periodo } = req.query;

  db.query(
    'SELECT idEfector FROM cierres WHERE periodo = ?',
    [periodo],
    (err, results) => {
      if (err) {
        console.error('Error al obtener efectores con cierre:', err);
        return res.status(500).send('Error al obtener efectores con cierre');
      }
      const ids = results.map(r => r.idEfector);
      res.json(ids);
    }
  );
};

const listarCierres = (req, res) => {
  CierreService.listarCierres((err, results) => {
    if (err) {
      console.error('Error al listar cierres:', err);
      return res.status(500).send('Error al listar cierres');
    }
    res.json(results);
  });
};

const crearCierreMasivo = async (req, res) => {
  try {
    const { periodo, efectoresIds, idUsuario } = req.body;

    if (!periodo || !efectoresIds || !Array.isArray(efectoresIds) || efectoresIds.length === 0 || !idUsuario) {
      return res.status(400).json({ error: 'Faltan datos requeridos o la lista de efectores está vacía.' });
    }

    const cierres = await CierreService.crearCierreMasivo(periodo, efectoresIds, idUsuario);

    res.status(201).json({ 
      message: 'Cierre general ejecutado correctamente', 
      totalCierres: cierres.length,
      cierres 
    });
  } catch (err) {
    console.error('Error en crearCierreMasivo:', err);
    res.status(500).json({ error: 'Error al procesar el cierre general en la base de datos' });
  }
};

const obtenerDetalleCierre = async (req, res) => {
  try {
    const { idcierre } = req.params;

    if (!idcierre) {
      return res.status(400).json({ error: 'Falta el ID del cierre' });
    }

    // Llamas al servicio encargado de buscar el detalle agrupado por efector/hospital
    const detalle = await CierreService.obtenerDetalleCierrePorId(idcierre);

    res.status(200).json({ 
      success: true, 
      data: detalle 
    });
  } catch (err) {
    console.error('Error en obtenerDetalleCierre:', err);
    res.status(500).json({ error: 'Error al obtener el detalle del cierre' });
  }
};

// Asegúrate de exportarlo junto a los demás
module.exports = { crearCierre, efectoresConCierre, listarCierres, crearCierreMasivo, obtenerDetalleCierre };


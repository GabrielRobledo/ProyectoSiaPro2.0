const model = require('../models/auditoriasProgresoModels');

const saveOrUpdate = async (req, res) => {
  const idUsuario = parseInt(req.params.idUsuario, 10);
  const { idEfector, periodo, datos } = req.body;

  try {
    // 👉 Verificamos si ya existe un registro
    const yaExiste = await model.get(idUsuario, idEfector, periodo);

    if (yaExiste) {
      return res.status(409).json({
        message: 'Ya existe un borrador en progreso para este efector y período.',
      });
    }

    // Si no existe, lo creamos
    await model.upsert(idUsuario, idEfector, periodo, datos);
    res.json({ message: 'Guardado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar auditoría en progreso' });
  }
};


const getDraft = async (req, res) => {
  const idUsuario = parseInt(req.params.idUsuario, 10);
  const idEfector = parseInt(req.params.idEfector, 10);
  const periodo = req.params.periodo;

  try {
    const datos = await model.get(idUsuario, idEfector, periodo);
    if (!datos) return res.status(404).json({ message: 'No hay borrador' });
    res.json(JSON.parse(datos));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener borrador' });
  }
};

const deleteDraft = async (req, res) => {
  const idUsuario = parseInt(req.params.idUsuario, 10);
  const idEfector = parseInt(req.params.idEfector, 10);
  const periodo = req.params.periodo;

  try {
    await model.remove(idUsuario, idEfector, periodo);
    res.json({ message: 'Borrador eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar borrador' });
  }
};

const deleteProgreso = async (req, res) => {
  const idSerial = parseInt(req.params.idSerial, 10);
  
  try {
    await model.deleteProgreso(idSerial);
    res.json({ message: 'Borrador eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar borrador' });
  }
};

const listarBorradores = async (req, res) => {
  const idUsuario = parseInt(req.params.idUsuario, 10);
  try {
    const borradores = await model.listarParaUsuario(idUsuario);
    res.json(borradores);
  } catch (err) {
    console.error('Error al listar borradores:', err);
    res.status(500).json({ error: 'Error al listar borradores' });
  }
};

const updateByIdSerial = async (req, res) => {
  const idSerial = parseInt(req.params.idSerial, 10);
  const { datos } = req.body;

  if (!idSerial || !datos) {
    return res.status(400).json({ error: 'Faltan datos para actualizar' });
  }

  try {
    await model.updateOnlyData(idSerial, datos);
    res.json({ message: 'Actualizado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el borrador' });
  }
};

module.exports = {
  saveOrUpdate,
  getDraft,
  deleteDraft,
  listarBorradores,
  deleteProgreso,
  updateByIdSerial
};


const db = require('../db/conexion');
const { Asignaciones, AsignacionesSinAuditoria, auditoriasEnProgreso } = require('../models/asignacionesModels');

// Asignar hospitales a un auditor (elimina los anteriores y agrega los nuevos)
exports.asignarEfectores = (req, res) => {
  const { idUsuario, efectoresIds } = req.body;

  if (!idUsuario || !Array.isArray(efectoresIds)) {
    return res.status(400).json({ msg: 'Datos inválidos' });
  }

  // Primero eliminamos asignaciones previas
  db.query('DELETE FROM auditor_efector WHERE idUsuario = ?', [idUsuario], (err) => {
    if (err) {
        console.error('Error en DELETE:', err); // 👈 agregá esto
        return res.status(500).json({ msg: 'Error al limpiar asignaciones previas', error: err });
    }

    if (efectoresIds.length === 0) {
      return res.json({ msg: 'Asignaciones actualizadas (vacías)' });
    }

    // Luego insertamos nuevas asignaciones
    const values = efectoresIds.map(idEfector => [idUsuario, idEfector]);
    db.query('INSERT INTO auditor_efector (idUsuario, idEfector) VALUES ?', [values], (err2) => {
      if (err2) return res.status(500).json({ msg: 'Error al asignar efectores' });
      res.json({ msg: 'Asignación realizada con éxito' });
    });
  });
};


// Obtener efectores asignados a un auditor (solo ids)
exports.obtenerEfectoresPorAuditor = (req, res) => {
  const { id } = req.params;
  db.query('SELECT idEfector FROM auditor_efector WHERE idUsuario = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ msg: 'Error al obtener asignaciones' });
    res.json(results.map(row => row.idEfector));
  });
};

exports.eliminarAsignacion = (req, res) => {
  const { idUsuario } = req.params;

  // 1. Validar si el auditor tiene auditorías en progreso o borradores
  const sqlValidacion = 'SELECT COUNT(*) AS total FROM auditoria_en_progreso WHERE idUsuario = ?';

  db.query(sqlValidacion, [idUsuario], (err, results) => {
    if (err) {
      console.error('Error al validar borradores:', err);
      return res.status(500).json({ msg: 'Error al verificar el estado del auditor' });
    }

    const totalBorradores = results[0].total;

    // Si tiene borradores/progreso, BLOQUEAMOS la eliminación
    if (totalBorradores > 0) {
      return res.status(400).json({ 
        msg: 'No se puede eliminar la asignación porque el auditor posee auditorías en curso o borradores. Utilice la opción de reasignación.' 
      });
    }

    // 2. Si no tiene borradores, procedemos a eliminar las asignaciones de hospitales
    db.query('DELETE FROM auditor_efector WHERE idUsuario = ?', [idUsuario], (errDel, result) => {
      if (errDel) {
        console.error('Error al eliminar asignaciones:', errDel);
        return res.status(500).json({ msg: 'Error al eliminar asignaciones' });
      }
      res.json({ msg: 'Asignaciones eliminadas correctamente' });
    });
  });
};


// Obtener todas las asignaciones (usuario + efector)
exports.obtenerTodasAsignaciones = (req, res) => {
  const sql = 'SELECT idUsuario, idEfector FROM `auditor_efector`';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error al obtener asignaciones:', err);
      return res.status(500).json({ msg: 'Error al obtener asignaciones' });
    }
    res.json(results); 
  });
};

exports.ObtenerAsignacionesSinAuditoria = (req, res) => {
  const { idUsuario } = req.params;

  const sqlRol = 'SELECT idTipoUsuario FROM usuarios WHERE idUsuario = ?';
  
  db.query(sqlRol, [idUsuario], (err, userRows) => {
    if (err || userRows.length === 0) {
      console.error('Error al verificar el rol del usuario:', err);
      return res.status(500).json({ msg: 'Error al verificar el usuario' });
    }

    const idTipoUsuario = userRows[0].idTipoUsuario;
    let sqlQuery = '';
    let queryParams = [];

    // Consulta adaptada para incluir los totales por ámbito (Ambulatorio e Internación)
    if (idTipoUsuario === 1) {
      sqlQuery = `
        SELECT 
          e.idEfector, 
          e.codPrestador, 
          e.RazonSocial,
          SUM(CASE WHEN a.tipoAtencion LIKE '%ambulatorio%' THEN 1 ELSE 0 END) AS Ambulatorio,
          SUM(CASE WHEN a.tipoAtencion LIKE '%internacion%' THEN 1 ELSE 0 END) AS Internacion
        FROM efectores e
        LEFT JOIN atenciones a ON e.idEfector = a.idEfector
        WHERE e.idEfector NOT IN (SELECT COALESCE(idEfector, 0) FROM cierres)
          AND e.idEfector NOT IN (SELECT COALESCE(idEfector, 0) FROM auditoria_en_progreso)
        GROUP BY e.idEfector, e.codPrestador, e.RazonSocial
      `;
      queryParams = [];
    } else {
      sqlQuery = `
        SELECT 
          e.idEfector, 
          e.codPrestador, 
          e.RazonSocial,
          SUM(CASE WHEN a.tipoAtencion LIKE '%ambulatorio%' THEN 1 ELSE 0 END) AS Ambulatorio,
          SUM(CASE WHEN a.tipoAtencion LIKE '%internacion%' THEN 1 ELSE 0 END) AS Internacion
        FROM efectores e
        JOIN auditor_efector ae ON e.idEfector = ae.idEfector
        LEFT JOIN atenciones a ON e.idEfector = a.idEfector
        WHERE ae.idUsuario = ?
          AND e.idEfector NOT IN (SELECT COALESCE(idEfector, 0) FROM cierres)
          AND e.idEfector NOT IN (SELECT COALESCE(idEfector, 0) FROM auditoria_en_progreso)
        GROUP BY e.idEfector, e.codPrestador, e.RazonSocial
      `;
      queryParams = [idUsuario];
    }

    db.query(sqlQuery, queryParams, (errQuery, asignaciones) => {
      if (errQuery) {
        console.error('Error al obtener asignaciones sin auditoría:', errQuery);
        return res.status(500).json({ msg: 'Error al obtener asignaciones sin auditoría' });
      }
      res.json(asignaciones);
    });
  });
};

// Obtener auditorías en progreso para un usuario
exports.obtenerAuditoriasEnProgreso = (req, res) => {
  const { idUsuario } = req.params;
  auditoriasEnProgreso.getAuditoriasEnProgreso(idUsuario, (err, auditorias) => {
    if (err) {
      console.error('Error al obtener auditorías en progreso:', err);
      return res.status(500).json({ msg: 'Error al obtener auditorías en progreso' });
    }
    res.json(auditorias);
  });
}

// Reasignar hospitales y auditorías en progreso de un auditor a otro
exports.reasignarAuditor = (req, res) => {
  const { idUsuarioOrigen, idUsuarioDestino } = req.body;

  if (!idUsuarioOrigen || !idUsuarioDestino) {
    return res.status(400).json({ msg: 'Faltan datos obligatorios (origen o destino)' });
  }

  // Iniciamos una transacción para garantizar atomicidad
  db.beginTransaction((err) => {
    if (err) {
      console.error('Error al iniciar transacción:', err);
      return res.status(500).json({ msg: 'Error interno en el servidor' });
    }

    // 1. Reasignar los hospitales en la tabla de relación (auditor_efector)
    const sqlEfectores = 'UPDATE auditor_efector SET idUsuario = ?, reasignado = 1 WHERE idUsuario = ?';
    
    db.query(sqlEfectores, [idUsuarioDestino, idUsuarioOrigen], (err, resultEfectores) => {
      if (err) {
        return db.rollback(() => {
          console.error('Error al reasignar efectores:', err);
          res.status(500).json({ msg: 'Error al reasignar los hospitales' });
        });
      }

      // 2. Reasignar los borradores en curso (auditoria_en_progreso)
      const sqlProgreso = 'UPDATE auditoria_en_progreso SET idUsuario = ? WHERE idUsuario = ?';

      db.query(sqlProgreso, [idUsuarioDestino, idUsuarioOrigen], (err2, resultProgreso) => {
        if (err2) {
          return db.rollback(() => {
            console.error('Error al reasignar auditorías en progreso:', err2);
            res.status(500).json({ msg: 'Error al reasignar los borradores en curso' });
          });
        }

        // Si todo sale bien, confirmamos la transacción
        db.commit((err3) => {
          if (err3) {
            return db.rollback(() => {
              console.error('Error al hacer commit:', err3);
              res.status(500).json({ msg: 'Error al confirmar la reasignación' });
            });
          }

          res.json({ 
            msg: 'Reasignación completada con éxito',
            efectoresActualizados: resultEfectores.affectedRows,
            borradoresActualizados: resultProgreso.affectedRows
          });
        });
      });
    });
  });
};

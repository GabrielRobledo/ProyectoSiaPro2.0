const db = require('../db/conexion');
const auditoriaModel = require('../models/auditoriaModels');
const borradoresModel = require('../models/auditoriasProgresoModels');
const resumenModel = require('../models/auditoriaModels');

exports.crearAuditoria = (req, res) => {
  const { periodo, idEfector, totalDebito, detalles } = req.body;

  if (!periodo || !idEfector || !detalles || detalles.length === 0) {
    return res.status(400).json({ mensaje: 'Datos incompletos' });
  }

  // 🔍 PASO CLAVE: Consultamos quién es el usuario actual en la tabla de progreso 
  // (esto garantiza que si fue reasignado, obtengamos el ID del auditor nuevo).
  db.query(
    'SELECT idUsuario FROM auditoria_en_progreso WHERE idEfector = ? AND periodo = ?',
    [idEfector, periodo],
    (errProg, progRows) => {
      if (errProg) {
        console.error(errProg);
        return res.status(500).json({ mensaje: 'Error al verificar el auditor en progreso' });
      }

      // Si existe un registro en progreso, usamos ese idUsuario (el nuevo). 
      // Si por alguna razón no está, recurrimos al que viene por req.body.
      const idUsuarioFinal = progRows.length > 0 ? progRows[0].idUsuario : req.body.idUsuario;

      if (!idUsuarioFinal) {
        return res.status(400).json({ mensaje: 'No se pudo determinar el auditor responsable' });
      }

      db.beginTransaction((err) => {
        if (err) return res.status(500).json({ mensaje: 'Error iniciando transacción' });

        db.query(
          'INSERT INTO auditoria (periodo, idUsuario, idEfector, totalDebito) VALUES (?, ?, ?, ?)',
          [periodo, idUsuarioFinal, idEfector, totalDebito],
          (err, result) => {
            if (err) return db.rollback(() => {
              console.error(err);
              res.status(500).json({ mensaje: 'Error al guardar auditoría' });
            });

            const idAuditoria = result.insertId;
            const inserts = detalles.map((d) => [d.idAtencion, idAuditoria, d.idMotivo || null, d.debito]);

            db.query(
              'INSERT INTO `detalle-auditoria` (idAtencion, idAuditoria, idMotivo, importe) VALUES ?',
              [inserts],
              (err) => {
                if (err) return db.rollback(() => {
                  console.error(err);
                  res.status(500).json({ mensaje: 'Error al guardar detalles' });
                });

                db.commit((err) => {
                  if (err) return db.rollback(() => {
                    console.error(err);
                    res.status(500).json({ mensaje: 'Error al confirmar transacción' });
                  });

                  res.json({ mensaje: 'Auditoría registrada con éxito', idAuditoria });
                });
              }
            );
          }
        );
      });
    }
  );
};

exports.listarAuditorias = (req, res) => {
  db.query(`
    SELECT 
      a.idAuditoria, e.RazonSocial, a.periodo, a.idUsuario, a.idEfector, a.totalDebito,
      da.idAtencion, da.importe AS debito, at.valorTotal
    FROM auditoria as a
    JOIN \`detalle-auditoria\` as da ON a.idAuditoria = da.idAuditoria 
    JOIN efectores as e ON e.idEfector = a.idEfector 
    JOIN atenciones as at ON da.idAtencion = at.idAtencion
    LEFT JOIN motivos m ON da.idMotivo = m.idMotivo
    ORDER BY a.idAuditoria DESC;
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al listar auditorías' });

    const result = rows.reduce((acc, r) => {
      if (!acc[r.idAuditoria]) {
        acc[r.idAuditoria] = {
          idAuditoria: r.idAuditoria,
          Hospital: r.RazonSocial,
          periodo: r.periodo,
          idUsuario: r.idUsuario,
          idEfector: r.idEfector,
          totalDebito: r.totalDebito,
          totalFacturado: 0, 
          detalles: []
        };
      }
      acc[r.idAuditoria].detalles.push({
        idAtencion: r.idAtencion,
        debito: r.debito,
        valorTotal: r.valorTotal
      });
      acc[r.idAuditoria].totalFacturado += parseFloat(r.valorTotal || 0);
      return acc;
    }, {});

    res.json(Object.values(result));
  });
};


exports.obtenerAuditoria = async (req, res) => {
  const { id } = req.params;

  // Primero intentamos obtener una auditoría cerrada
  db.query(
    `
    SELECT 
      a.idAuditoria, a.periodo, a.idUsuario, a.idEfector, a.totalDebito,
      da.idAtencion, da.importe AS debito, da.idMotivo,
      at.tipoAtencion, at.fecha, 
      b.apeYnom, 
      n.codPractica, at.fechaPractica, 
      at.cantidad, at.valorTotal, 
      m.descripcion AS moduloDescripcion, 
      ef.RazonSocial AS hospital
    FROM auditoria a
    JOIN \`detalle-auditoria\` da ON da.idAuditoria = a.idAuditoria
    JOIN atenciones at ON at.idAtencion = da.idAtencion
    INNER JOIN beneficiarios b ON at.idBeneficiario = b.idBeneficiario
    INNER JOIN nomencladores n ON at.idNomenclador = n.idNomenclador
    INNER JOIN modulos m ON n.idModulo = m.idModulo
    INNER JOIN efectores ef ON at.idEfector = ef.idEfector
    WHERE a.idAuditoria = ?
    `,
    [id],
    async (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al obtener auditoría' });
      }

      // ✅ Si encontramos una auditoría cerrada
      if (rows.length > 0) {
        const aud = {
          idAuditoria: rows[0].idAuditoria,
          periodo: rows[0].periodo,
          idUsuario: rows[0].idUsuario,
          idEfector: rows[0].idEfector,
          totalDebito: rows[0].totalDebito,
          detalles: rows.map(r => ({
            idAtencion: r.idAtencion,
            tipoAtencion: r.tipoAtencion,
            fecha: r.fecha,
            apeYnom: r.apeYnom,
            codPractica: r.codPractica,
            fechaPractica: r.fechaPractica,
            cantidad: r.cantidad,
            valorTotal: parseFloat(r.valorTotal),
            moduloDescripcion: r.moduloDescripcion,
            hospital: r.hospital,
            idMotivo: r.idMotivo || null,
            debito: parseFloat(r.debito)
          }))
        };
        return res.json(aud);
      }

      // 🔄 Si no existe, intentamos buscar como borrador
      try {
        const borrador = await borradoresModel.getDraftById(id);
        if (!borrador) return res.status(404).json({ error: 'No existe la auditoría' });

        res.json({
          idAuditoria: parseInt(id),
          periodo: borrador.periodo,
          idEfector: borrador.idEfector,
          idUsuario: borrador.idUsuario,
          totalDebito: borrador.totalDebito,
          detalles: borrador.detalles || []
        });
      } catch (error) {
        console.error('Error al obtener borrador:', error);
        res.status(500).json({ error: 'Error interno al obtener auditoría' });
      }
    }
  );
};

exports.editarAuditoria = (req, res) => {
  const { id } = req.params;
  const { periodo, totalDebito, detalles } = req.body;

  db.beginTransaction(err => {
    if (err) return res.status(500).json({ error: 'Error al iniciar transacción' });

    db.query(
      'UPDATE auditoria SET periodo = ?, totalDebito = ? WHERE idAuditoria = ?',
      [periodo, totalDebito, id],
      err => {
        if (err) return db.rollback(() => res.status(500).json({ error: 'Error al actualizar auditoría' }));

        db.query('DELETE FROM `detalle-auditoria` WHERE idAuditoria = ?', [id], err => {
          if (err) return db.rollback(() => res.status(500).json({ error: 'Error al eliminar detalles anteriores' }));

          const valores = detalles.map(d => [
            id,
            d.idAtencion,
            d.idMotivo || null, 
            d.debito,
          ]);

          db.query(
            'INSERT INTO `detalle-auditoria` (idAuditoria, idAtencion, idMotivo, importe) VALUES ?',
            [valores],
            err => {
              if (err) return db.rollback(() => res.status(500).json({ error: 'Error al insertar nuevos detalles' }));

              db.commit(err => {
                if (err) return db.rollback(() => res.status(500).json({ error: 'Error al confirmar edición' }));
                res.json({ mensaje: 'Auditoría editada correctamente' });
              });
            }
          );
        });
      }
    );
  });
};

exports.borrarAuditoria = (req, res) => {
  const { id } = req.params;
  db.beginTransaction(err => {
    if (err) return res.status(500).json({ error: 'Error al iniciar transacción' });

    db.query('DELETE FROM `detalle-auditoria` WHERE idAuditoria = ?', [id], err => {
      if (err) return db.rollback(() => res.status(500).json({ error: 'Error al eliminar detalles' }));

      db.query('DELETE FROM auditoria WHERE idAuditoria = ?', [id], err => {
        if (err) return db.rollback(() => res.status(500).json({ error: 'Error al eliminar auditoría' }));

        db.commit(err => {
          if (err) return db.rollback(() => res.status(500).json({ error: 'Error al confirmar eliminación' }));
          res.json({ mensaje: 'Auditoría eliminada correctamente' });
        });
      });
    });
  });
};


exports.getEstadoAuditorias = async (req, res) => {
  const { periodo, idUsuario } = req.params;

  try {
    const efectores = await auditoriaModel.getEfectores();
    const cerradas = await auditoriaModel.getEfectoresConAuditoriaCerrada(periodo);
    const borradores = await auditoriaModel.getEfectoresConBorrador(periodo, idUsuario);

    const setCerradas = new Set(cerradas);
    const setBorradores = new Set(borradores);

    const resultado = efectores.map((e) => {
      let estado = 'SIN_INICIAR';
      if (setCerradas.has(e.idEfector)) estado = 'CERRADA';
      else if (setBorradores.has(e.idEfector)) estado = 'BORRADOR';

      return {
        idEfector: e.idEfector,
        RazonSocial: e.RazonSocial,
        estado,
      };
    });

    res.json({ efectores: resultado });
  } catch (error) {
    console.error('Error en getEstadoAuditorias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getBorradores = async (req, res) => {
  const idUsuario = parseInt(req.params.idUsuario, 10);

  try {
    const borradores = await new Promise((resolve, reject) => {
      db.query(
        `
        SELECT 
          aep.idSerial AS id,
          aep.idUsuario,
          aep.idEfector,
          aep.periodo,
          e.RazonSocial
        FROM auditoria_en_progreso aep
        JOIN efectores e ON aep.idEfector = e.idEfector
        WHERE aep.idUsuario = ?
        `,
        [idUsuario],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    res.json(borradores);
  } catch (error) {
    console.error('Error al obtener borradores:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.obtenerBorradorPorEfector = async (req, res) => {
  const idEfector = parseInt(req.params.idEfector, 10);
  const idUsuario = req.query.idUsuario ? parseInt(req.query.idUsuario, 10) : null;

  if (isNaN(idEfector)) {
    return res.status(400).json({ error: 'idEfector inválido' });
  }

  try {
    const borrador = await borradoresModel.getDraftByEfector(idEfector, idUsuario);
    //console.log('Borrador obtenido:', borrador);  // <--- Aquí

    if (!borrador) return res.status(404).json({ error: 'No se encontró borrador' });

    res.json(borrador);
  } catch (err) {
    console.error('Error en obtenerBorradorPorEfector:', err);
    res.status(500).json({ error: 'Error interno obteniendo borrador' });
  }
};


exports.obtenerResumenAuditor = async (req, res) => {
  const idUsuario = parseInt(req.params.idUsuario, 10);
  if (isNaN(idUsuario)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const auditorias = await resumenModel.getResumenPorAuditor(idUsuario);

    const total = auditorias.length;
    const ultima = auditorias[0]?.periodo || null;

    const periodosUnicos = new Set(auditorias.map(a => a.periodo));
    const promedioPorMes = periodosUnicos.size ? (total / periodosUnicos.size).toFixed(2) : 0;

    res.json({
      resumen: {
        totalAuditorias: total,
        ultimoPeriodo: ultima,
        promedioPorMes
      },
      auditorias
    });
  } catch (err) {
    console.error('Error al obtener resumen del auditor:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.countAuditoriasXUsuario = async (req, res) => {
  try {
    const resultados = await auditoriaModel.getCountAuditoriasXUsuario();
    res.json(resultados);
  } catch (err) {
    console.error('Error al contar auditorías por usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


// controllers/cierreController.js
const CierreService = require('../services/cierreServices');

const crearCierreMasivo = (periodo, efectoresIds, idUsuario) => {
    return new Promise((resolve, reject) => {
      // 1. Primero validamos si ya existe un cierre general para este periodo
      db.query(`SELECT id FROM cierres_generales WHERE periodo = ?`, [periodo], (errCheck, existingRows) => {
        if (errCheck) return reject(errCheck);

        if (existingRows && existingRows.length > 0) {
          return reject(new Error(`El periodo ${periodo} ya cuenta con un cierre general registrado.`));
        }

        // 2. Si no existe, procedemos con la transacción habitual
        db.beginTransaction(async (err) => {
          if (err) return reject(err);

          try {
            const cierresCreados = [];

            const queryTrans = (sql, params) => new Promise((res, rej) => {
              db.query(sql, params, (error, results) => {
                if (error) return rej(error);
                res(results);
              });
            });

            const maxIdGenRows = await queryTrans(`SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM cierres_generales`);
            const nextIdCierreGeneral = maxIdGenRows[0].nextId;

            await queryTrans(`
              INSERT INTO cierres_generales 
              (id, periodo, fecha_cierre, idUsuario, total_filas, total_atenciones, observaciones) 
              VALUES (?, ?, NOW(), ?, ?, 0, ?)
            `, [nextIdCierreGeneral, periodo, idUsuario, efectoresIds.length, `Cierre general ejecutado para el periodo ${periodo}`]);

            const idCierreGeneral = nextIdCierreGeneral;
            let totalAtencionesGeneral = 0;

            for (const idEfector of efectoresIds) {
              const resumenRows = await queryTrans(`
                SELECT 
                  COUNT(DISTINCT a.idAtencion) AS cantidadAtenciones,
                  SUM(IFNULL(a.valorTotal, 0)) AS totalFacturadoGeneral,
                  SUM(IFNULL(da.importe, 0)) AS totalDebitadoGeneral,
                  SUM(CASE WHEN da.importe > 0 THEN 1 ELSE 0 END) AS cantidadDebitos
                FROM atenciones a
                JOIN auditoria au ON a.idEfector = au.idEfector AND au.periodo = ?
                LEFT JOIN \`detalle-auditoria\` da ON a.idAtencion = da.idAtencion
                WHERE a.idEfector = ?
              `, [periodo, idEfector]);

              const resumen = resumenRows[0] || {};
              const cantidadAtenciones = resumen.cantidadAtenciones || 0;
              const totalFacturadoGeneral = resumen.totalFacturadoGeneral || 0;
              const totalDebitadoGeneral = resumen.totalDebitadoGeneral || 0;
              const totalNeto = totalFacturadoGeneral - totalDebitadoGeneral;
              const cantidadDebitos = resumen.cantidadDebitos || 0;

              totalAtencionesGeneral += cantidadAtenciones;

              const resultCierreViejo = await queryTrans(`
                INSERT INTO cierres 
                (idUsuario, idEfector, periodo, totalFacturadoGeneral, totalDebitadoGeneral, totalNeto, cantidadAtenciones, cantidadDebitos, fechaCierre) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
              `, [idUsuario, idEfector, periodo, totalFacturadoGeneral, totalDebitadoGeneral, totalNeto, cantidadAtenciones, cantidadDebitos]);

              const idCierreViejo = resultCierreViejo.insertId;

              await queryTrans(`
                INSERT INTO cierres_detalle (idCierre, idAtencion, tieneDebito, totalDebito, motivos)
                SELECT 
                  ? AS idCierre,
                  a.idAtencion,
                  CASE WHEN MAX(da.importe) > 0 THEN TRUE ELSE FALSE END AS tieneDebito,
                  IFNULL(MAX(da.importe), 0) AS totalDebito,
                  IFNULL(MAX(IF(da.importe > 0, m.motivo, NULL)), '') AS motivos
                FROM atenciones a
                JOIN auditoria au ON a.idEfector = au.idEfector AND au.periodo = ?
                LEFT JOIN \`detalle-auditoria\` da ON a.idAtencion = da.idAtencion
                LEFT JOIN motivos m ON da.idMotivo = m.idMotivo
                WHERE a.idEfector = ?
                GROUP BY a.idAtencion
              `, [idCierreViejo, periodo, idEfector]);

              const montosEfectorRows = await queryTrans(`
                SELECT 
                  SUM(IFNULL(a.valorTotal, 0)) AS monto_facturado,
                  SUM(IFNULL(da.importe, 0)) AS monto_debitado,
                  CASE WHEN SUM(IFNULL(da.importe, 0)) > 0 THEN 1 ELSE 0 END AS tiene_debito
                FROM atenciones a
                JOIN auditoria au ON a.idEfector = au.idEfector AND au.periodo = ?
                LEFT JOIN \`detalle-auditoria\` da ON a.idAtencion = da.idAtencion
                WHERE a.idEfector = ?
              `, [periodo, idEfector]);

              const montos = montosEfectorRows[0] || {};
              const montoFacturado = montos.monto_facturado || 0;
              const montoDebitado = montos.monto_debitado || 0;
              const montoNeto = montoFacturado - montoDebitado;
              const tieneDebito = montos.tiene_debito || 0;

              const maxIdAtcRows = await queryTrans(`SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM atenciones_cierre`);
              const nextIdAtencionesCierre = maxIdAtcRows[0].nextId;

              await queryTrans(`
                INSERT INTO atenciones_cierre 
                (id, idCierre, idEfector, monto_facturado, monto_debitado, monto_neto, tiene_debito) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `, [nextIdAtencionesCierre, idCierreGeneral, idEfector, montoFacturado, montoDebitado, montoNeto, tieneDebito]);

              cierresCreados.push({ idCierre: idCierreGeneral, idEfector, montoNeto });
            }

            await queryTrans(`
              UPDATE cierres_generales 
              SET total_atenciones = ? 
              WHERE id = ?
            `, [totalAtencionesGeneral, idCierreGeneral]);

            db.commit((errCommit) => {
              if (errCommit) {
                return db.rollback(() => {
                  reject(errCommit);
                });
              }
              resolve(cierresCreados);
            });

          } catch (error) {
            console.error('❌ Error crítico en transacción de cierre masivo:', error);
            db.rollback(() => {
              reject(error);
            });
          }
        });
      });
    });
  },

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

const listarCierresGenerales = (req, res) => {
  CierreService.listarCierresGenerales((err, results) => {
    if (err) {
      console.error('Error al listar cierres generales:', err);
      return res.status(500).send('Error al listar cierres generales');
    }
    res.json(results);
  });
};

const crearCierreMasivo = async (req, res) => {
  try {
    console.log('Datos recibidos para cierre masivo:', req.body);
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
module.exports = { crearCierre, efectoresConCierre, listarCierres, crearCierreMasivo, obtenerDetalleCierre, listarCierresGenerales };


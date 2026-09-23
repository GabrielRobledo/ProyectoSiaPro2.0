const db = require('../db/conexion');

const Cierre = {
  crearCierre(idEfector, periodo, idUsuario, callback) {
    const sql = 'INSERT INTO cierres (idEfector, periodo, idUsuario) VALUES (?, ?, ?)';
    db.query(sql, [idEfector, periodo, idUsuario], (err, result) => {
      if (err) return callback(err);
      console.log('Nuevo idCierre:', result.insertId);
      callback(null, result.insertId);
    });
  },

  guardarDetalle(idCierre, idEfector, periodo, callback) {
    const sql = `
      INSERT INTO cierres_detalle (idCierre, idAtencion, tieneDebito, totalDebito, motivos)
      SELECT 
        ? AS idCierre,
        a.idAtencion,
        CASE WHEN da.importe > 0 THEN TRUE ELSE FALSE END AS tieneDebito,
        IFNULL(da.importe, 0) AS totalDebito,
        IF(da.importe > 0 AND m.motivo IS NOT NULL, m.motivo, NULL) AS motivos
      FROM atenciones a
      JOIN auditoria au ON a.idEfector = au.idEfector
      LEFT JOIN \`detalle-auditoria\` da ON a.idAtencion = da.idAtencion
      LEFT JOIN motivos m ON da.idMotivo = m.idMotivo
      WHERE a.idEfector = ?
      AND au.periodo = ?
      GROUP BY a.idAtencion;
    `;

    db.query(sql, [idCierre, idEfector, periodo], (err, result) => {
      if (err) {
        console.error('Error en guardarDetalle:', err);
        return callback(err);
      }
      callback(null, result);
    });
  },
  // 1. ESTA ES LA QUE DA ERROR SI FALTA (La que usa el servicio viejo)
  listarCierres(callback) {
    const sql = `
      SELECT c.idCierre, c.periodo, c.idEfector, e.RazonSocial, u.nombre AS usuario
      FROM cierres c
      JOIN efectores e ON c.idEfector = e.idEfector
      JOIN usuarios u ON c.idUsuario = u.idUsuario
      ORDER BY c.periodo DESC, e.RazonSocial;
    `;
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  },

  listarCierresGenerales(callback) {
    const sql = `
      SELECT 
        cg.id AS idCierreGeneral, 
        cg.periodo, 
        cg.fecha_cierre, 
        cg.total_atenciones, 
        IFNULL(u.nombre, 'Sistema') AS usuario
      FROM cierres_generales cg
      LEFT JOIN usuarios u ON cg.idUsuario = u.idUsuario
      ORDER BY cg.periodo DESC, cg.fecha_cierre DESC;
    `;
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Error detallado en listarCierresGenerales:', err);
        return callback(err);
      }
      callback(null, results);
    });
  },

crearCierreMasivo(periodo, efectoresIds, idUsuario) {
    return new Promise((resolve, reject) => {
      db.beginTransaction(async (err) => {
        if (err) return reject(err);

        try {
          const cierresCreados = [];

          // Helper para promesas con la conexión directa
          const queryTrans = (sql, params) => new Promise((res, rej) => {
            db.query(sql, params, (error, results) => {
              if (error) return rej(error);
              res(results);
            });
          });

          // 1. Obtener el siguiente ID manual para `cierres_generales`
          const maxIdGenRows = await queryTrans(`SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM cierres_generales`);
          const nextIdCierreGeneral = maxIdGenRows[0].nextId;

          // Insertar la cabecera general
          await queryTrans(`
            INSERT INTO cierres_generales 
            (id, periodo, fecha_cierre, idUsuario, total_filas, total_atenciones, observaciones) 
            VALUES (?, ?, NOW(), ?, ?, 0, ?)
          `, [nextIdCierreGeneral, periodo, idUsuario, efectoresIds.length, `Cierre general ejecutado para el periodo ${periodo}`]);

          const idCierreGeneral = nextIdCierreGeneral;
          let totalAtencionesGeneral = 0;

          for (const idEfector of efectoresIds) {
            
            // A. PROCESO TRADICIONAL (Tablas viejas: `cierres` y `cierres_detalle`)
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


            // B. PROCESO NUEVO (Tabla `atenciones_cierre`)
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

          // Actualizar total de atenciones
          await queryTrans(`
            UPDATE cierres_generales 
            SET total_atenciones = ? 
            WHERE id = ?
          `, [totalAtencionesGeneral, idCierreGeneral]);

          // 2. Confirmar transacción en la conexión directa
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
  },

obtenerDetalleCierrePorId(idCierre, callback) {
    const sql = `
      SELECT 
          e.RazonSocial AS hospital,
          ac.monto_facturado AS total_facturado,
          ac.monto_debitado AS total_debitado,
          ac.monto_neto AS total_neto,
          ac.tiene_debito AS cantidad_debitos
      FROM atenciones_cierre AS ac
      JOIN efectores AS e ON ac.idEfector = e.idEfector
      WHERE ac.idCierre = ?
    `;
    db.query(sql, [idCierre], callback);
  }
};

module.exports = Cierre;


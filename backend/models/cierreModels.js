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
      console.log('Resultado guardarDetalle:', result);
      callback(null, result);
    });
  },

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
  // Dentro de tu archivo de modelo/servicio (ej: cierreModel.js o cierreServices.js)

  crearCierreMasivo(periodo, efectoresIds, idUsuario) {
    return new Promise((resolve, reject) => {
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

          for (const idEfector of efectoresIds) {
            
            // 1. Obtener totales de atenciones y facturación general sin cruzar con detalles para evitar duplicidad
            const atencionesRows = await queryTrans(`
              SELECT 
                COUNT(DISTINCT a.idAtencion) AS cantidadAtenciones,
                SUM(IFNULL(a.valorTotal, 0)) AS totalFacturadoGeneral
              FROM atenciones a
              JOIN auditoria au ON a.idEfector = au.idEfector AND au.periodo = ?
              WHERE a.idEfector = ?
            `, [periodo, idEfector]);

            const resumenAtenciones = atencionesRows[0] || {};
            const cantidadAtenciones = resumenAtenciones.cantidadAtenciones || 0;
            const totalFacturadoGeneral = resumenAtenciones.totalFacturadoGeneral || 0;

            // 2. Obtener totales de débitos de forma independiente
            const debitosRows = await queryTrans(`
              SELECT 
                COUNT(DISTINCT da.idAtencion) AS cantidadDebitos,
                SUM(IFNULL(da.importe, 0)) AS totalDebitadoGeneral
              FROM \`detalle-auditoria\` da
              JOIN atenciones a ON da.idAtencion = a.idAtencion
              JOIN auditoria au ON a.idEfector = au.idEfector AND au.periodo = ?
              WHERE a.idEfector = ? AND da.importe > 0
            `, [periodo, idEfector]);

            const resumenDebitos = debitosRows[0] || {};
            const totalDebitadoGeneral = resumenDebitos.totalDebitadoGeneral || 0;
            const cantidadDebitos = resumenDebitos.cantidadDebitos || 0;
            const totalNeto = totalFacturadoGeneral - totalDebitadoGeneral;

            // 3. Insertar la cabecera del cierre
            const resultCierre = await queryTrans(`
              INSERT INTO cierres 
              (idUsuario, idEfector, periodo, totalFacturadoGeneral, totalDebitadoGeneral, totalNeto, cantidadAtenciones, cantidadDebitos, fechaCierre) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [idUsuario, idEfector, periodo, totalFacturadoGeneral, totalDebitadoGeneral, totalNeto, cantidadAtenciones, cantidadDebitos]);

            const idCierre = resultCierre.insertId;

            // 4. Insertar los detalles agrupados por atención (usando GROUP_CONCAT para agrupar motivos si hay varios)
            await queryTrans(`
              INSERT INTO cierres_detalle (idCierre, idAtencion, tieneDebito, totalDebito, motivos)
              SELECT 
                ? AS idCierre,
                a.idAtencion,
                CASE WHEN SUM(IFNULL(da.importe, 0)) > 0 THEN TRUE ELSE FALSE END AS tieneDebito,
                SUM(IFNULL(da.importe, 0)) AS totalDebito,
                IFNULL(GROUP_CONCAT(DISTINCT m.motivo SEPARATOR ', '), '') AS motivos
              FROM atenciones a
              JOIN auditoria au ON a.idEfector = au.idEfector AND au.periodo = ?
              LEFT JOIN \`detalle-auditoria\` da ON a.idAtencion = da.idAtencion
              LEFT JOIN motivos m ON da.idMotivo = m.idMotivo
              WHERE a.idEfector = ?
              GROUP BY a.idAtencion
            `, [idCierre, periodo, idEfector]);

            cierresCreados.push({ idCierre, idEfector, totalNeto });
          }

          db.commit((errCommit) => {
            if (errCommit) {
              return db.rollback(() => reject(errCommit));
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

  // Nueva función para obtener el resumen/detalle de un cierre por efector para la vista de React
  obtenerDetalleCierrePorId(idCierre, callback) {
    const sql = `
      SELECT 
          \`e\`.\`nombre\` AS \`hospital\`,
          \`c\`.\`cantidadAtenciones\` AS \`cantidad_atenciones\`,
          \`c\`.\`totalFacturadoGeneral\` AS \`total_facturado\`,
          \`c\`.\`totalDebitadoGeneral\` AS \`total_debitado\`,
          \`c\`.\`totalNeto\` AS \`total_neto\`,
          \`c\`.\`cantidadDebitos\` AS \`cantidad_debitos\`
      FROM \`cierres\` AS \`c\`
      JOIN \`efectores\` AS \`e\` ON \`c\`.\`idEfector\` = \`e\`.\`idefector\`
      WHERE \`c\`.\`idcierre\` = ?
    `;
    db.query(sql, [idCierre], callback);
  }
  
};





module.exports = Cierre;

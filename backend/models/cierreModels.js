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
      db.getConnection((err, connection) => {
        if (err) {
          // Si tu conexión no soporta pool.getConnection, usaremos consultas directas
          return reject(err);
        }

        connection.beginTransaction(async (errTx) => {
          if (errTx) {
            connection.release();
            return reject(errTx);
          }

          try {
            const cierresCreados = [];

            // Función auxiliar para promesas con la conexión de la transacción
            const queryTrans = (sql, params) => new Promise((res, rej) => {
              connection.query(sql, params, (error, results) => {
                if (error) return rej(error);
                res(results);
              });
            });

            for (const idEfector of efectoresIds) {
              
              // 1. Calcular los indicadores macro exigidos para la tesis
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

              // 2. Insertar cabecera con totales
              const resultCierre = await queryTrans(`
                INSERT INTO cierres 
                (idUsuario, idEfector, periodo, totalFacturadoGeneral, totalDebitadoGeneral, totalNeto, cantidadAtenciones, cantidadDebitos, fechaCierre) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
              `, [idUsuario, idEfector, periodo, totalFacturadoGeneral, totalDebitadoGeneral, totalNeto, cantidadAtenciones, cantidadDebitos]);

              const idCierre = resultCierre.insertId;

              // 3. Insertar detalles
              await queryTrans(`
                INSERT INTO cierres_detalle (idCierre, idAtencion, tieneDebito, totalDebito, motivos)
                SELECT 
                  ? AS idCierre,
                  a.idAtencion,
                  CASE WHEN da.importe > 0 THEN TRUE ELSE FALSE END AS tieneDebito,
                  IFNULL(da.importe, 0) AS totalDebito,
                  IF(da.importe > 0 AND m.motivo IS NOT NULL, m.motivo, NULL) AS motivos
                FROM atenciones a
                JOIN auditoria au ON a.idEfector = au.idEfector AND au.periodo = ?
                LEFT JOIN \`detalle-auditoria\` da ON a.idAtencion = da.idAtencion
                LEFT JOIN motivos m ON da.idMotivo = m.idMotivo
                WHERE a.idEfector = ?
                GROUP BY a.idAtencion
              `, [idCierre, periodo, idEfector]);

              cierresCreados.push({ idCierre, idEfector, totalNeto });
            }

            connection.commit((errCommit) => {
              if (errCommit) {
                return connection.rollback(() => {
                  connection.release();
                  reject(errCommit);
                });
              }
              connection.release();
              resolve(cierresCreados);
            });

          } catch (error) {
            connection.rollback(() => {
              connection.release();
              reject(error);
            });
          }
        });
      });
    });
  }
};



module.exports = Cierre;

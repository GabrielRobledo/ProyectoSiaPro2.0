const db = require('../db/conexion');

const Asignaciones = {
  // Devuelve los efectores asignados a un usuario, con info del hospital
  getEfectoresPorUsuario: (idUsuario, callback) => {
    const sql = `
      SELECT e.idEfector, e.RazonSocial
      FROM auditor_efector ae
      JOIN efectores e ON ae.idEfector = e.idEfector
      WHERE ae.idUsuario = ?
    `;
    db.query(sql, [idUsuario], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  },
};

const AsignacionesSinAuditoria = {
    // Devuelve los efectores pendientes con sus totales según el rol
    getAsignacionesSinAuditoria: (idUsuario, callback) => {
        // Primero necesitamos saber si el usuario es admin o auditor
        const sqlRol = 'SELECT idTipoUsuario FROM usuarios WHERE idUsuario = ?';
        
        db.query(sqlRol, [idUsuario], (err, userRows) => {
            if (err || userRows.length === 0) {
                return callback(err || new Error('Usuario no encontrado'));
            }

            const idTipoUsuario = userRows[0].idTipoUsuario;
            let sql = '';
            let params = [];

            if (idTipoUsuario === 1) {
                // Administrador: ve TODOS los hospitales pendientes generales (sin cierres ni borradores)
                sql = `
                    SELECT 
                        e.idEfector, 
                        e.codPrestador, 
                        e.RazonSocial,
                        SUM(CASE WHEN LOWER(a.tipoAtencion) LIKE '%ambulatorio%' THEN 1 ELSE 0 END) AS ambulatorio,
                        SUM(CASE WHEN LOWER(a.tipoAtencion) LIKE '%internacion%' THEN 1 ELSE 0 END) AS internacion
                    FROM efectores e
                    LEFT JOIN atenciones a ON e.idEfector = a.idEfector
                    WHERE e.idEfector NOT IN (SELECT COALESCE(idEfector, 0) FROM auditoria)
                      AND e.idEfector NOT IN (SELECT COALESCE(idEfector, 0) FROM auditoria_en_progreso)
                    GROUP BY e.idEfector, e.codPrestador, e.RazonSocial
                `;
                params = [];
            } else {
                // Auditor: ve solo SUS hospitales asignados y pendientes (tu lógica original mejorada)
                sql = `
                    SELECT 
                        e.idEfector, 
                        e.codPrestador, 
                        e.RazonSocial,
                        SUM(CASE WHEN LOWER(a.tipoAtencion) LIKE '%ambulatorio%' THEN 1 ELSE 0 END) AS ambulatorio,
                        SUM(CASE WHEN LOWER(a.tipoAtencion) LIKE '%internacion%' THEN 1 ELSE 0 END) AS internacion
                    FROM efectores e
                    JOIN auditor_efector ae ON e.idEfector = ae.idEfector
                    LEFT JOIN atenciones a ON e.idEfector = a.idEfector
                    WHERE ae.idUsuario = ?
                      AND e.idEfector NOT IN (SELECT COALESCE(idEfector, 0) FROM auditoria)
                      AND e.idEfector NOT IN (SELECT COALESCE(idEfector, 0) FROM auditoria_en_progreso)
                    GROUP BY e.idEfector, e.codPrestador, e.RazonSocial
                `;
                params = [idUsuario];
            }

            db.query(sql, params, (errQuery, results) => {
                if (errQuery) return callback(errQuery);
                callback(null, results);
            });
        });
    }
};

const auditoriasEnProgreso = {
    // Devuelve las auditorías en progreso para un usuario
    getAuditoriasEnProgreso: (idUsuario, callback) => {
        const sql = `
            SELECT ap.idSerial, ap.idEfector, e.RazonSocial
            FROM auditoria_en_progreso ap
            JOIN efectores e ON ap.idEfector = e.idEfector
            WHERE ap.idUsuario = ?
        `;
        db.query(sql, [idUsuario], (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    },
};   


module.exports = {Asignaciones, AsignacionesSinAuditoria, auditoriasEnProgreso};

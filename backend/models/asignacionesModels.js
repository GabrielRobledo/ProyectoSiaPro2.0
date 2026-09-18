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
    // Devuelve los efectores asignados a un usuario, solo ids
        // Devuelve los efectores asignados a un usuario, con idAsignacion e idEfector
    getAsignacionesSinAuditoria: (idUsuario, callback) => {
        const sql = `
            SELECT a.*, e.RazonSocial, ae.reasignado
            FROM atenciones AS a
            JOIN efectores e ON a.idEfector = e.idEfector
            JOIN auditor_efector ae ON a.idEfector = ae.idEfector AND ae.idUsuario = ?
            WHERE a.idEfector IN (
                SELECT ae2.idEfector
                FROM auditor_efector AS ae2
                LEFT JOIN auditoria AS au ON ae2.idEfector = au.idEfector
                LEFT JOIN auditoria_en_progreso AS ap ON ae2.idEfector = ap.idEfector
                WHERE ae2.idUsuario = ? AND au.idAuditoria IS NULL AND ap.idSerial IS NULL
            )
            ORDER BY a.idAtencion ASC
        `;
        db.query(sql, [idUsuario, idUsuario], (err, results) => {
            if (err) return callback(err);
            callback(null, results);
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

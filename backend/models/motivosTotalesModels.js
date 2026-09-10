const db = require('../db/conexion');

const motivosTotales = {
    getAll: (callback) => {
        db.query('select m.motivo, COUNT(da.idAtencion) as "cantidad" from `detalle-auditoria` as da inner join motivos as m on da.idMotivo = m.idMotivo GROUP BY m.motivo;', (err, results)=>{
            if (err) return callback(err);
            callback(null, results)
        });
    }
};

module.exports = motivosTotales
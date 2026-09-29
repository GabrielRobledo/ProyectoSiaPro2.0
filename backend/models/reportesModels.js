const db = require('../db/conexion');

const practicasConDebitos = {
  getAll: (filtros, callback) => {
    let sql = `
      SELECT 
        n.descripcion AS practica,
        m.descripcion AS modulo,
        SUM(da.importe) AS total_debitado,
        COUNT(*) AS cantidad_debitos
      FROM 
        \`detalle-auditoria\` da
      JOIN 
        atenciones a ON da.idAtencion = a.idAtencion
      JOIN 
        nomencladores n ON a.idNomenclador = n.idNomenclador
      JOIN 
        modulos m ON n.idModulo = m.idModulo
      WHERE 
        da.importe > 0
    `;

    const queryParams = [];

    // Solo mantenemos el filtro de módulo por si lo usas en el futuro o viene de otro lado
    if (filtros && filtros.modulo) {
      sql += ` AND m.descripcion = ?`;
      queryParams.push(filtros.modulo);
    }

    sql += `
      GROUP BY 
        n.idNomenclador, n.descripcion, m.descripcion
      HAVING 
        SUM(da.importe) > 0
      ORDER BY 
        total_debitado DESC
    `;

    db.query(sql, queryParams, (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  }
};

module.exports = practicasConDebitos;
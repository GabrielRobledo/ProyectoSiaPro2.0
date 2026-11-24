const db = require('../db/conexion');

const createUser = (nombre, usuario, contraseña, idTipoUsuario, callback) => {
  const sql = 'INSERT INTO usuarios (nombre, usuario, contraseña, idTipoUsuario) VALUES (?, ?, ?, ?)';
  db.query(sql, [nombre, usuario, contraseña, idTipoUsuario], callback);
};

const getUserByUsername = (usuario, callback) => {
  const sql = `
    SELECT u.*, t.tipo AS rol
    FROM usuarios u
    LEFT JOIN tipousuarios t ON u.idTipoUsuario = t.idTipoUsuario
    WHERE u.usuario = ? AND u.delete_add IS NULL
  `;
  db.query(sql, [usuario], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

const updateUser = (id, nombre, usuario, idTipoUsuario, callback) => {
  const sql = 'UPDATE usuarios SET nombre = ?, usuario = ?, idTipoUsuario = ? WHERE idUsuario = ? AND delete_add IS NULL';
  db.query(sql, [nombre, usuario, idTipoUsuario, id], callback);
};

// ⚠️ Eliminación lógica
const deleteUser = (id, callback) => {
  const sql = 'UPDATE usuarios SET delete_add = CURRENT_TIMESTAMP WHERE idUsuario = ?';
  db.query(sql, [id], callback);
};

const getAllUsers = (mostrarEliminados = false, callback) => {
  let sql = `
    SELECT u.idUsuario, u.nombre, u.usuario, u.delete_add, t.tipo AS tipoUsuario
    FROM usuarios u
    JOIN tipousuarios t ON u.idTipoUsuario = t.idTipoUsuario
  `;
  
  if (!mostrarEliminados) {
    sql += ' WHERE u.delete_add IS NULL';
  }

  db.query(sql, callback);
};


const restoreUser = (id, callback) => {
  const sql = 'UPDATE usuarios SET delete_add = NULL WHERE idUsuario = ?';
  db.query(sql, [id], callback);
};

const getUserById = (id, callback) => {
  const sql = 'SELECT * FROM usuarios WHERE idUsuario = ? AND delete_add IS NULL';
  db.query(sql, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

const updatePassword = (id, nuevaContraseña, callback) => {
  const sql = 'UPDATE usuarios SET contraseña = ? WHERE idUsuario = ? AND delete_add IS NULL';
  db.query(sql, [nuevaContraseña, id], callback);
};

module.exports = {
  createUser,
  getUserByUsername,
  getAllUsers,
  updateUser,
  deleteUser,
  restoreUser,
  getUserById,
  updatePassword,
};
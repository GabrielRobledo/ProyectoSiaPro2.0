import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { FiTrash2, FiRotateCcw } from 'react-icons/fi';
import API_URL from '../config';
import '../styles/registerUser.css';
import { useUser } from './contextUsers';

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    usuario: '',
    contraseña: '',
    idTipoUsuario: 1
  });

  const [users, setUsers] = useState([]);
  const [mostrarEliminados, setMostrarEliminados] = useState(false);
  const { user: userLogged } = useUser();

  useEffect(() => {
    fetchUsers();
  }, [mostrarEliminados]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/auth/usuarios?eliminados=${mostrarEliminados}`);
      setUsers(res.data);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log(formData); 
    try {
      const res = await axios.post(`${API_URL}/api/auth/register`, formData);
      Swal.fire({
        icon: 'success',
        title: '¡Registro exitoso!',
        text: res.data.msg,
        confirmButtonColor: '#007bff'
      });
      setFormData({ nombre: '', usuario: '', contraseña: '', idTipoUsuario: 1 });
      fetchUsers();
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.msg || 'Error en el registro',
        confirmButtonColor: '#d33'
      });
    }
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        axios.delete(`${API_URL}/api/auth/usuarios/${id}`)
          .then(() => {
            Swal.fire('Eliminado', 'Usuario eliminado correctamente', 'success');
            fetchUsers();
          })
          .catch((err) => {
            const mensaje = err.response?.data?.msg || 'No se pudo eliminar el usuario';
            Swal.fire('No se puede eliminar', mensaje, 'error');
          });
      }
    });
  };

  const handleRestore = (id) => {
    Swal.fire({
      title: '¿Restaurar usuario?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, restaurar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        axios.put(`${API_URL}/api/auth/usuarios/restore/${id}`)
          .then(() => {
            Swal.fire('Restaurado', 'El usuario fue restaurado', 'success');
            fetchUsers();
          })
          .catch(() => Swal.fire('Error', 'No se pudo restaurar', 'error'));
      }
    });
  };

  return (
    <div className="register-container">
      <form className="register-form" onSubmit={handleSubmit}>
        <h2>Registrar Usuario</h2>
        <input
          type="text"
          name="nombre"
          placeholder="Nombre completo"
          value={formData.nombre}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="usuario"
          placeholder="Correo electrónico"
          value={formData.usuario}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="contraseña"
          placeholder="Contraseña"
          value={formData.contraseña}
          onChange={handleChange}
          required
        />
        <select
          name="idTipoUsuario"
          value={formData.idTipoUsuario}
          onChange={handleChange}
        >
          <option value="1">Administrador</option>
          <option value="2">Auditor</option>
        </select>
        <button type="submit">Registrar</button>
      </form>

      {/* Mostrar la lista de usuarios en una tabla */}
      <div className="user-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <label className="custom-checkbox">
            <input
              type="checkbox"
              checked={mostrarEliminados}
              onChange={() => setMostrarEliminados(!mostrarEliminados)}
            />
            <span className="checkbox-span"></span>
            Mostrar eliminados
          </label>
        </div>
        
        <table className="user-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Tipo</th>
              <th>Eliminar</th>
              <th>Restaurar</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.idUsuario} className={user.delete_add ? 'deleted' : ''}>
                <td>{user.nombre}</td>
                <td>{user.usuario}</td>
                <td>{user.tipoUsuario}</td>
                <td>
                  {!user.delete_add && user.idUsuario !== parseInt(userLogged?.idUsuario) && (
                    <FiTrash2 onClick={() => handleDelete(user.idUsuario)} />
                  )}
                </td>
                <td>
                  {user.delete_add && (
                    <FiRotateCcw onClick={() => handleRestore(user.idUsuario)} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RegisterForm;

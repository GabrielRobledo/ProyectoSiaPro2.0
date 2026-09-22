import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from './contextUsers';

const RutaPorRol = ({ rolesPermitidos = [] }) => {
  const { user } = useUser();

  if (!user || !user?.rol) {
    return <Navigate to="/login" replace />;
  }

  if (!rolesPermitidos.includes(user.rol.toLowerCase())) {
    return (
      <div>
        <h2>Acceso denegado</h2>
        <p>Tu rol: {user.rol}</p>
        <p>Roles permitidos: {rolesPermitidos.join(', ')}</p>
      </div>
    );
  }

  return <Outlet />;
};

export default RutaPorRol;

import { Routes, Route } from 'react-router-dom';
import BasicLayout from './components/layout';
import Dashboard from './components/dashboard';
import Login from './components/login';
import Home from './components/home'
import DashboardAuditor from './components/dashboardAuditor';
import VistaRegistros from './components/vistaRegistros';
import RegisterForm from './components/registrarUsuario';
import Usuarios from './components/usuarios';
import AsignarHospitales from './components/AsignarUserHosp';
import AuditoriasList from './components/listaAuditorias';
import ResultadosBusqueda from './components/ResultadosBusquedas';
import Perfil from './components/perfil';
import AuditoriaDetalle from './components/auditoriaDetallePDF';
import HospConBorradorCards from './components/listadoAuditoriasBorradores';
import TablaBorradores from './components/tablaAuditoriaProgreso';
import EstadisticasCierresAuditorias from './components/estadisticasCierresAuditorias';
import CierreDeAuditoria from './components/cierreDeAuditoria';
import ResumenAuditor from './components/resumenAuditor';
import ReportesAuditorias from './components/reportesEstadisticos';
import EstadisticasAsignaciones from './components/estadisticasAsignacionesAuditores';
import PracticasMasDebitadas from './components/estadisticasPracticas';
import RutaProtegida from './components/rutasProtegidas';
import RutaPorRol from './components/rutasPorRol';
import AdminNovedades from './components/novedades';
import Motivos from './components/motivosForms';
import UpdatePeriodoFacturacion from './components/UpdatePeriodoFacturacion';


const hoy = new Date();
const anio = hoy.getFullYear();
const mes = String(hoy.getMonth() + 1).padStart(2, '0');
const periodo = `${anio}-${mes}`;
const user = JSON.parse(localStorage.getItem('user') || '{}');
const idUsuario = user?.idUsuario || null;

const App = () => {
  return (
    <Routes>
      <Route path='login' element={<Login />} />

      {/* Rutas protegidas generales */}
      <Route element={<RutaProtegida />}>
        <Route path="/" element={<BasicLayout />}>

          <Route index element={<Dashboard />} />
          <Route path='dashboard' element={<Dashboard />} />
          <Route path='perfil' element={<Perfil />} />

          {/* Rutas solo para ADMIN */}
          <Route element={<RutaPorRol rolesPermitidos={['administrador']} />}>
            <Route path='usuarios' element={<Usuarios />} />
            <Route path='register' element={<RegisterForm />} />
            <Route path='asignaciones' element={<AsignarHospitales />} />
            <Route path='reportes/reportesAsignaciones' element={<EstadisticasAsignaciones />} />
            <Route path='reportes/reportesAuditorias' element={<ReportesAuditorias />} />
            <Route path='reportes/practicas-mas-debitadas' element={<PracticasMasDebitadas />} />
            <Route path='resumen-auditor/:idUsuario' element={<ResumenAuditor />} />
            <Route path='cierreDeAuditoria' element={<CierreDeAuditoria periodo={periodo} idUsuario={idUsuario} />} />
            <Route path='novedades' element={<AdminNovedades />} />
            <Route path='motivos' element={<Motivos />} />
            <Route path='actualizar-datos' element={<UpdatePeriodoFacturacion />} />
          </Route>

          {/* Rutas solo para AUDITOR */}
          <Route element={<RutaPorRol rolesPermitidos={['auditor']} />}>
            <Route path='dashboardAuditor' element={<DashboardAuditor />} />
            <Route path='resumen-auditor/:idUsuario' element={<ResumenAuditor />} />
            <Route path='auditoriasParciales' element={<HospConBorradorCards />} />
            <Route path='borradores/tabla/:idEfector' element={<TablaBorradores />} />
          </Route>

          {/* Rutas compartidas */}
          <Route path='auditorias' element={<AuditoriasList />} />
          <Route path='auditorias/:id' element={<VistaRegistros editarAuditoria={true} />} />
          <Route path='auditorias/:id/detalle' element={<AuditoriaDetalle />} />
          <Route path='registros/:tipo' element={<VistaRegistros />} />
          <Route path='busqueda' element={<ResultadosBusqueda />} />
          <Route path='estadisticasCierres' element={<EstadisticasCierresAuditorias />} />
 

        </Route>
      </Route>
    </Routes>

  );
};

export default App;
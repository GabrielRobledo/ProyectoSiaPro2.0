import { useEffect, useState } from 'react';
import axios from 'axios';
import KpiCard from './kipcards';
import ResumenHospitalesModal from './resumenHospModal';
import { getResumenHospitales } from '../utils/resumenPorHosp';
import FacturacionHospitalModal from './facturacionHospModal';
import { getFacturacionPorHospital } from '../utils/facturacionPorHosp';
import ResumenAuditorias from './resumenAuditorias';
import { Avatar, List, ListItem, ListItemAvatar, ListItemText, Divider } from '@mui/material';
import API_URL from '../config';
import {
  Modal,
  Box,
  Typography
} from '@mui/material';
import { Close } from '@mui/icons-material';
import {
  FaUserInjured,
  FaMoneyBillWave,
  FaHospital,
  FaUsers,
  FaUserShield,
  FaBuilding,
  FaUserTimes,
  FaHospitalAlt
} from 'react-icons/fa';

const Dashboard = () => {
  const [atenciones, setAtenciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [efectores, setEfectores] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalItems, setModalItems] = useState([]);
  const [openHospitalsModal, setOpenHospitalsModal] = useState(false);
  const [hospitalesDelAuditor, setHospitalesDelAuditor] = useState([]);
  const [openResumenModal, setOpenResumenModal] = useState(false);
  const [resumenData, setResumenData] = useState(null);
  const [openFactModal, setOpenFactModal] = useState(false);
  const [facturacionResumen, setFacturacionResumen] = useState(null);

  const handleOpenModal = (title, items) => {
    setModalTitle(title);
    setModalItems(items);
    setOpenModal(true);
  };

  const handleOpenResumenHospitales = () => {
    const data = getResumenHospitales(atenciones);
    setResumenData(data);
    setOpenResumenModal(true);
  };

  const handleCloseModal = () => setOpenModal(false);

  const handleVerHospitales = (auditor) => {
    const hospitales = asignaciones
      .filter(a => a.idUsuario === auditor.idUsuario)
      .map(a => efectores.find(e => e.idEfector === a.idEfector)?.RazonSocial)
      .filter(Boolean);

    setHospitalesDelAuditor(hospitales);
    setOpenHospitalsModal(true);
  };

  const handleOpenFacturacionModal = () => {
    const resumen = getFacturacionPorHospital(atenciones);
    setFacturacionResumen(resumen);
    setOpenFactModal(true);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [atRes, usRes, efRes, asigRes] = await Promise.all([
          axios.get(`${API_URL}/api/atenciones`),
          axios.get(`${API_URL}/api/auth/usuarios`),
          axios.get(`${API_URL}/api/efectores`),
          axios.get(`${API_URL}/api/asignaciones`),
        ]);
        setAtenciones(atRes.data);
        setUsuarios(usRes.data);
        setEfectores(efRes.data);
        setAsignaciones(asigRes.data);
      } catch (error) {
        console.error('Error al cargar los datos del dashboard', error);
      }
    };
    fetchData();
  }, []);

  // KPIs
  const totalAtenciones = atenciones.length;
  const totalFacturado = atenciones.reduce((acc, item) => acc + (item.valorTotal || 0), 0);
  const totalEfectoresAtendidos = new Set(atenciones.map(a => a.idEfector)).size;
  const totalBeneficiarios = new Set(atenciones.map(a => a.apeYnom)).size;

  const auditores = usuarios.filter(u => u.tipoUsuario === 'auditor');
  const auditoresAsignados = new Set(asignaciones.map(a => a.idUsuario));
  const efectoresAsignados = new Set(asignaciones.map(a => a.idEfector));

  const totalAuditores = auditores.length;
  const totalAuditoresAsignados = auditores.filter(a => auditoresAsignados.has(a.idUsuario)).length;
  const totalAuditoresSinAsignar = totalAuditores - totalAuditoresAsignados;

  const totalHospitales = efectores.length;
  const totalHospitalesAsignados = efectores.filter(e => efectoresAsignados.has(e.idEfector)).length;
  const totalHospitalesSinAsignar = totalHospitales - totalHospitalesAsignados;

return (
  <div style={{ padding: '20px' }}>
    {/* Bloque: Atenciones */}
    <h2 style={{ marginBottom: '10px', color: '#4e73df' }}>📊 Datos de Atenciones</h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '40px' }}>
      <KpiCard icon={FaUserInjured} title="Total Atenciones" value={totalAtenciones} color="#4e73df" />
      <KpiCard icon={FaMoneyBillWave} title="Valor Total Facturado" value={`$${totalFacturado.toLocaleString()}`} color="#1cc88a" onClick={handleOpenFacturacionModal}/>
      <KpiCard icon={FaHospital} title="Efectores con Atenciones" value={totalEfectoresAtendidos} color="#36b9cc"  onClick={handleOpenResumenHospitales}/>
      <KpiCard icon={FaUsers} title="Beneficiarios Atendidos" value={totalBeneficiarios} color="#f6c23e" />
    </div>

    {/* Bloque: Asignaciones */}
    <h2 style={{ marginBottom: '10px', color: '#6f42c1' }}>🏥 Estado de Asignaciones</h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
      <KpiCard
        icon={FaUserShield}
        title="Auditores Asignados"
        value={totalAuditoresAsignados}
        color="#6f42c1"
        onClick={() =>
          handleOpenModal(
            'Auditores Asignados',
            auditores.filter(a => auditoresAsignados.has(a.idUsuario))
          )
        }
      />
      <KpiCard
        icon={FaUserTimes}
        title="Auditores Sin Asignar"
        value={totalAuditoresSinAsignar}
        color="#dc3545"
        onClick={() =>
          handleOpenModal(
            'Auditores Sin Asignar',
            auditores.filter(a => !auditoresAsignados.has(a.idUsuario)).map(a => a.nombre)
          )
        }
      />
      <KpiCard
        icon={FaBuilding}
        title="Hospitales Asignados"
        value={totalHospitalesAsignados}
        color="#20c997"
        onClick={() =>
          handleOpenModal(
            'Hospitales Asignados',
            efectores.filter(e => efectoresAsignados.has(e.idEfector)).map(e => e.RazonSocial)
          )
        }
      />
      <KpiCard
        icon={FaHospitalAlt}
        title="Hospitales Sin Asignar"
        value={totalHospitalesSinAsignar}
        color="#ffc107"
        onClick={() =>
          handleOpenModal(
            'Hospitales Sin Asignar',
            efectores.filter(e => !efectoresAsignados.has(e.idEfector)).map(e => e.RazonSocial)
          )
        }
      />
    </div>

    {/* Modal de listas (auditores / hospitales) */}
    <Modal open={openModal} onClose={handleCloseModal}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 500 },
          bgcolor: '#fff',
          borderRadius: 4,
          boxShadow: 10,
          p: 3,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>
            {modalTitle}
          </Typography>
          <Close
            onClick={handleCloseModal}
            sx={{
              cursor: 'pointer',
              color: '#888',
              '&:hover': { color: '#000' },
              transition: 'color 0.2s',
            }}
          />
        </Box>

        {/* Nuevo diseño para auditores y hospitales */}
        {['Hospitales Asignados', 'Hospitales Sin Asignar'].includes(modalTitle) ? (
          <List>
            {modalItems.map((name, idx) => (
              <ListItem key={idx}>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: '#20c997' }}>
                    <FaHospitalAlt />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={name} />
              </ListItem>
            ))}
          </List>
        ) : (
          <List>
            {modalItems.map((auditor, idx) => (
              <ListItem
                key={idx}
                secondaryAction={
                  modalTitle === 'Auditores Asignados' && (
                    <button
                      onClick={() => handleVerHospitales(auditor)}
                      style={{
                        padding: '6px 12px',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        transition: 'background 0.3s',
                      }}
                    >
                      Ver Hospitales
                    </button>
                  )
                }
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: '#6f42c1' }}>
                    {typeof auditor === 'string'
                      ? auditor.charAt(0).toUpperCase()
                      : auditor.nombre.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={typeof auditor === 'string' ? auditor : auditor.nombre}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Modal>

    {/* Modal: Hospitales del auditor */}
    <Modal open={openHospitalsModal} onClose={() => setOpenHospitalsModal(false)}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 400 },
          bgcolor: '#fff',
          borderRadius: 4,
          boxShadow: 10,
          p: 3,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>
            Hospitales Asignados
          </Typography>
          <Close
            onClick={() => setOpenHospitalsModal(false)}
            sx={{
              cursor: 'pointer',
              color: '#888',
              '&:hover': { color: '#000' },
              transition: 'color 0.2s',
            }}
          />
        </Box>

        {hospitalesDelAuditor.length > 0 ? (
          hospitalesDelAuditor.map((item, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                border: '1px solid #e0e0e0',
                borderRadius: 2,
                px: 2,
                py: 1.5,
                mb: 1.5,
                transition: 'background 0.2s',
                '&:hover': { backgroundColor: '#f9f9f9' },
              }}
            >
              <Avatar sx={{ bgcolor: '#36b9cc' }}>
                <FaHospitalAlt />
              </Avatar>
              <Typography variant="body1">{item}</Typography>
            </Box>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            No hay hospitales asignados.
          </Typography>
        )}
      </Box>
    </Modal>

    {/* Modal: Resumen de Efectores */}
    <Modal open={openResumenModal} onClose={() => setOpenResumenModal(false)}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '95%', sm: 1000 },
          bgcolor: '#fff',
          borderRadius: 4,
          boxShadow: 10,
          p: 3,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>
            Detalle de Efectores con Atenciones
          </Typography>
          <Close
            onClick={() => setOpenResumenModal(false)}
            sx={{
              cursor: 'pointer',
              color: '#888',
              '&:hover': { color: '#000' },
              transition: 'color 0.2s',
            }}
          />
        </Box>

        {resumenData ? (
          <ResumenHospitalesModal
            resumen={resumenData.resumen}
            tiposAtencionUnicos={resumenData.tiposAtencionUnicos}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Cargando datos...
          </Typography>
        )}
      </Box>
    </Modal>

    {/* Modal: Facturación */}
    <Modal open={openFactModal} onClose={() => setOpenFactModal(false)}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '95%', sm: 1000 },
          bgcolor: '#fff',
          borderRadius: 4,
          boxShadow: 10,
          p: 3,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>
            Total Facturado por Hospital
          </Typography>
          <Close
            onClick={() => setOpenFactModal(false)}
            sx={{
              cursor: 'pointer',
              color: '#888',
              '&:hover': { color: '#000' },
              transition: 'color 0.2s',
            }}
          />
        </Box>

        {facturacionResumen ? (
          <FacturacionHospitalModal resumen={facturacionResumen} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Cargando datos...
          </Typography>
        )}
      </Box>
    </Modal>

    {/* Resumen Auditorías */}
    <Box sx={{ mt: 5 }}>
      <ResumenAuditorias />
    </Box>
  </div>
);  

};

export default Dashboard;

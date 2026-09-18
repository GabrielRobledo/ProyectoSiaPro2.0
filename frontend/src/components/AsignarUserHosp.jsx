import { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  Container,
  Typography,
  Autocomplete,
  TextField,
  Grid,
  Box,
  Tabs,
  Tab,
  Stack,
  Chip,
  Tooltip,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { Delete as DeleteIcon, Add, Remove, TransferWithinAStation as TransferIcon } from '@mui/icons-material';
import API_URL from '../config'

const AsignarHospitales = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [efectores, setEfectores] = useState([]);
  const [asignacionesTotales, setAsignacionesTotales] = useState([]);
  const [auditorId, setAuditorId] = useState(null);
  const [asignados, setAsignados] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [tabIndex, setTabIndex] = useState(0);
  const [usuariosLibres, setUsuariosLibres] = useState([]);

const fetchData = async () => {
  try {
    const [usuariosRes, efectoresRes, asignacionesRes] = await Promise.all([
      axios.get(`${API_URL}/api/auth/usuarios`),
      axios.get(`${API_URL}/api/efectores`),
      axios.get(`${API_URL}/api/asignaciones`)
    ]);

    const usuariosData = usuariosRes.data;
    const efectoresData = efectoresRes.data;
    const asignacionesData = asignacionesRes.data;

    const auditores = usuariosData.filter(u => u.tipoUsuario === 'auditor');
    const auditoresAsignados = new Set(asignacionesData.map(a => a.idUsuario));
    const efectoresAsignados = new Set(asignacionesData.map(a => a.idEfector));

    // 1. Guardamos TODOS los auditores para usarlos en la reasignación
    setUsuarios(auditores); 

    // 2. Filtramos SOLO los libres para la pestaña de asignación inicial
    setUsuariosLibres(auditores.filter(a => !auditoresAsignados.has(a.idUsuario)));

    setEfectores(efectoresData.filter(e => !efectoresAsignados.has(e.idEfector)));
    setDisponibles(efectoresData.filter(e => !efectoresAsignados.has(e.idEfector)));

    const asignacionesAgrupadas = auditores
      .map(auditor => {
        const hospitales = asignacionesData
          .filter(a => a.idUsuario === auditor.idUsuario)
          .map(a => {
            const hosp = efectoresData.find(e => e.idEfector === a.idEfector);
            return hosp ? hosp.RazonSocial : 'Hospital no encontrado';
          });

        return {
          idUsuario: auditor.idUsuario,
          nombre: auditor.nombre,
          hospitales
        };
      })
      .filter(grupo => grupo.hospitales.length > 0);

    setAsignacionesTotales(asignacionesAgrupadas);
  } catch (error) {
    console.error(error);
    Swal.fire('Error', 'No se pudo cargar la información.', 'error');
  }
};

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!auditorId) {
      setAsignados([]);
      setDisponibles(efectores);
      return;
    }

    axios.get(`${API_URL}/api/asignaciones/${auditorId}`)
      .then(res => {
        const idsAsignados = res.data.map(a => a.idEfector);
        setAsignados(efectores.filter(e => idsAsignados.includes(e.idEfector)));
        setDisponibles(efectores.filter(e => !idsAsignados.includes(e.idEfector)));
      })
      .catch(() => {
        setAsignados([]);
        setDisponibles(efectores);
      });
  }, [auditorId, efectores]);

  const asignar = (idEfector) => {
    const seleccionado = disponibles.find(e => e.idEfector === idEfector);
    setAsignados(prev => [...prev, seleccionado]);
    setDisponibles(prev => prev.filter(e => e.idEfector !== idEfector));
  };

  const quitar = (idEfector) => {
    const seleccionado = asignados.find(e => e.idEfector === idEfector);
    setDisponibles(prev => [...prev, seleccionado]);
    setAsignados(prev => prev.filter(e => e.idEfector !== idEfector));
  };

  const handleSubmit = () => {
    if (!auditorId) {
      Swal.fire({
        icon: 'warning',
        title: 'Auditor no seleccionado',
        text: 'Seleccioná un auditor antes de guardar.',
      });
      return;
    }

    if (asignados.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin hospitales asignados',
        text: 'Debés asignar al menos un hospital antes de guardar.',
      });
      return;
    }

    const efectoresIds = asignados.map(e => e.idEfector);

    axios.post(`${API_URL}/api/asignar-efectores`, {
      idUsuario: auditorId,
      efectoresIds
    })
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: 'Asignación exitosa',
          text: 'Los hospitales fueron asignados correctamente.',
          timer: 2000,
          showConfirmButton: false,
        });
        setAuditorId(null);
        setAsignados([]);
        fetchData();
      })
      .catch(() => {
        Swal.fire({
          icon: 'error',
          title: 'Error al guardar',
          text: 'Ocurrió un problema al asignar los hospitales.',
        });
      });
  };


  // En AsignarUserHosp.jsx
  const eliminarAsignacion = (idUsuario) => {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción eliminará todas las asignaciones de este auditor.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
      if (result.isConfirmed) {
        axios.delete(`${API_URL}/api/asignaciones/${idUsuario}`)
          .then(() => {
            Swal.fire('Eliminado', 'Las asignaciones fueron eliminadas.', 'success');
            fetchData();
            setAuditorId(null);
            setAsignados([]);
          })
          .catch((error) => {
            // 👈 Aquí capturamos el mensaje exacto que envía el backend
            const mensajeError = error.response?.data?.msg || 'No se pudo eliminar la asignación.';
            Swal.fire('Operación Denegada', mensajeError, 'error');
          });
      }
    });
  };


  const abrirModalReasignar = async (grupoOrigen) => {
    // Filtrar otros auditores disponibles (excluyendo al actual)
    // Nota: podrías necesitar traer la lista completa de auditores activos
    const auditoresDisponibles = usuarios.filter(u => u.idUsuario !== grupoOrigen.idUsuario);

    if (auditoresDisponibles.length === 0) {
      Swal.fire('Atención', 'No hay otros auditores disponibles para la reasignación.', 'warning');
      return;
    }

    // Creamos un selector dinámico con SweetAlert2
    const inputOptions = {};
    auditoresDisponibles.forEach(aud => {
      inputOptions[aud.idUsuario] = aud.nombre;
    });

    const { value: nuevoAuditorId } = await Swal.fire({
      title: `Reasignar hospitales de ${grupoOrigen.nombre}`,
      input: 'select',
      inputOptions: inputOptions,
      inputPlaceholder: 'Seleccioná el nuevo auditor',
      showCancelButton: true,
      confirmButtonText: 'Transferir',
      cancelButtonText: 'Cancelar'
    });

    if (nuevoAuditorId) {
      try {
        // Llamada al backend para transferir
        await axios.put(`${API_URL}/api/asignaciones/reasignar`, {
          idUsuarioOrigen: grupoOrigen.idUsuario,
          idUsuarioDestino: Number(nuevoAuditorId)
        });

        Swal.fire('¡Éxito!', 'Los hospitales fueron reasignados correctamente.', 'success');
        fetchData();
      } catch (error) {
        const mensaje = error.response?.data?.message || 'No se pudo completar la reasignación.';
        Swal.fire('Error', mensaje, 'error');
      }
    }
  };
  

  return (
    <Container maxWidth="md" sx={{ mt: 5, mb: 5 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Gestión de Asignaciones
      </Typography>

      <Tabs
        value={tabIndex}
        onChange={(_, newIndex) => setTabIndex(newIndex)}
        indicatorColor="primary"
        textColor="primary"
        variant="fullWidth"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Asignar Hospitales" />
        <Tab label="Ver Asignaciones" />
      </Tabs>

      {tabIndex === 0 && (
        <>
          <Autocomplete
            options={usuariosLibres}
            getOptionLabel={(option) => option.nombre}
            value={usuarios.find(u => u.idUsuario === auditorId) || null}
            onChange={(_, newValue) => setAuditorId(newValue ? newValue.idUsuario : null)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Seleccionar Auditor"
                variant="outlined"
                sx={{ mb: 4 }}
              />
            )}
            clearOnEscape
          />

          {auditorId && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6}>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    fontWeight: 'bold',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    p: 1,
                    borderRadius: 1
                  }}
                >
                  Hospitales disponibles ({disponibles.length})
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  sx={{ maxHeight: 480, overflowY: 'auto' }}
                >
                  {disponibles.map(h => (
                    <Tooltip key={h.idEfector} title={h.RazonSocial}>
                      <Chip
                        label={h.RazonSocial.length > 20 ? `${h.RazonSocial.slice(0, 20)}...` : h.RazonSocial}
                        onClick={() => asignar(h.idEfector)}
                        deleteIcon={<Add />}
                        onDelete={() => asignar(h.idEfector)}
                        sx={{ maxWidth: 220, cursor: 'pointer' }}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    fontWeight: 'bold',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    p: 1,
                    borderRadius: 1
                  }}
                >
                  Hospitales asignados ({asignados.length})
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  sx={{ maxHeight: 480, overflowY: 'auto' }}
                >
                  {asignados.map(h => (
                    <Tooltip key={h.idEfector} title={h.RazonSocial}>
                      <Chip
                        label={h.RazonSocial.length > 20 ? `${h.RazonSocial.slice(0, 20)}...` : h.RazonSocial}
                        onClick={() => quitar(h.idEfector)}
                        deleteIcon={<Remove />}
                        onDelete={() => quitar(h.idEfector)}
                        color="secondary"
                        sx={{ maxWidth: 220, cursor: 'pointer' }}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          )}

          <Box display="flex" justifyContent="center" mt={4}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={!auditorId || asignados.length === 0}
            >
              Guardar Asignaciones
            </Button>
          </Box>
        </>
      )}

    {tabIndex === 1 && (
      <List sx={{ maxHeight: 600, overflowY: 'auto' }}>
        {asignacionesTotales.map((grupo) => (
          <ListItemButton key={grupo.idUsuario} sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <ListItemText
              primary={grupo.nombre}
              secondary={`Hospitales: ${grupo.hospitales.join(', ')}`}
            />
            <Stack direction="row" spacing={1}>
              <Tooltip title="Reasignar hospitales a otro auditor">
                <IconButton edge="end" color="primary" onClick={() => abrirModalReasignar(grupo)}>
                  <TransferIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Eliminar asignaciones">
                <IconButton edge="end" color="error" onClick={() => eliminarAsignacion(grupo.idUsuario)}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </ListItemButton>
        ))}
      </List>
    )}
    </Container>
  );
};

export default AsignarHospitales;

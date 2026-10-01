import { useEffect, useState, useMemo } from 'react';
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
import API_URL from '../config';

const AsignarHospitales = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [efectores, setEfectores] = useState([]);
  const [atenciones, setAtenciones] = useState([]); // 📅 Para extraer periodos y filtrar efectores
  const [asignacionesTotales, setAsignacionesTotales] = useState([]);
  const [auditorId, setAuditorId] = useState(null);
  const [asignados, setAsignados] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [tabIndex, setTabIndex] = useState(0);
  const [usuariosLibres, setUsuariosLibres] = useState([]);
  // Al cargar los datos en fetchData(), puedes extraer esto:
  const todosLosEfectoresAsignadosGlobales = new Set(asignacionesRes.data.map(a => a.idEfector));
  // 📅 Estado para el período del filtro
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');

  const fetchData = async () => {
    try {
      const [usuariosRes, efectoresRes, asignacionesRes, atencionesRes] = await Promise.all([
        axios.get(`${API_URL}/api/auth/usuarios`),
        axios.get(`${API_URL}/api/efectores`),
        axios.get(`${API_URL}/api/asignaciones`),
        axios.get(`${API_URL}/api/atenciones`)
      ]);

      const usuariosData = usuariosRes.data;
      const efectoresData = efectoresRes.data;
      const asignacionesData = asignacionesRes.data;
      const atencionesData = atencionesRes.data;

      setAtenciones(atencionesData);
      setEfectores(efectoresData);

      const auditores = usuariosData.filter(u => u.tipoUsuario === 'auditor');
      const auditoresAsignados = new Set(asignacionesData.map(a => a.idUsuario));

      setUsuarios(auditores); 
      setUsuariosLibres(auditores.filter(a => !auditoresAsignados.has(a.idUsuario)));

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

  // Función auxiliar para normalizar fechas de atenciones a 'YYYY-MM'
  const convertirFechaAPeriodo = (fechaStr) => {
    if (!fechaStr) return null;
    if (/^\d{4}-\d{2}$/.test(fechaStr)) return fechaStr;
    const partes = fechaStr.split('-');
    if (partes.length === 3) {
      const [dia, mesTexto, anioDosDigitos] = partes;
      const meses = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
        'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
      };
      const mesNum = meses[mesTexto.toUpperCase()];
      const anioCompleto = `20${anioDosDigitos}`;
      if (mesNum) return `${anioCompleto}-${mesNum}`;
    }
    return fechaStr.slice(0, 7);
  };

  // 📅 Extraer períodos únicos desde las atenciones
  const periodosDisponibles = useMemo(() => {
    const setP = new Set(
      atenciones.map(a => a.periodo || convertirFechaAPeriodo(a.fecha)).filter(Boolean)
    );
    return Array.from(setP).sort().reverse();
  }, [atenciones]);

  // Seleccionar por defecto el primer período si está vacío
  useEffect(() => {
    if (periodosDisponibles.length > 0 && !periodoSeleccionado) {
      setPeriodoSeleccionado(periodosDisponibles[0]);
    }
  }, [periodosDisponibles, periodoSeleccionado]);

// 🏥 Filtrar los hospitales disponibles según el período, los ya asignados en BD y los asignados localmente en pantalla
  useEffect(() => {
    if (!auditorId) {
      setAsignados([]);
      setDisponibles([]);
      return;
    }

    // 1. Obtener los IDs de efectores que tienen atenciones en el período seleccionado
    const efectoresIdsEnPeriodo = new Set(
      atenciones
        .filter(a => {
          if (!periodoSeleccionado) return true;
          const pItem = a.periodo || convertirFechaAPeriodo(a.fecha);
          return String(pItem) === String(periodoSeleccionado);
        })
        .map(a => a.idEfector)
    );

    // 2. Traer las asignaciones actuales del auditor desde la API
    axios.get(`${API_URL}/api/asignaciones/${auditorId}`)
      .then(res => {
        const idsAsignadosBD = res.data.map(a => a.idEfector);
        
        // Hospitales ya asignados al auditor (iniciales de BD)
        const hospitalAsignadosBD = efectores.filter(e => idsAsignadosBD.includes(e.idEfector));
        setAsignados(hospitalAsignadosBD);

        // Obtenemos los IDs que ya están en el estado local 'asignados' por si el usuario acaba de mover alguno
        const idsAsignadosActuales = new Set(hospitalAsignadosBD.map(e => e.idEfector));

        // Hospitales disponibles: en el período, y que NO estén asignados a NADIE en todo el sistema
        const filtradosPorPeriodo = efectores.filter(e => 
          efectoresIdsEnPeriodo.has(e.idEfector) && !todosLosEfectoresAsignadosGlobales.has(e.idEfector)
        );
        setDisponibles(filtradosPorPeriodo);
      })
      .catch(() => {
        setAsignados([]);
        setDisponibles([]);
      });
    }, [auditorId, efectores, atenciones, periodoSeleccionado]);

  // Modificar la función asignar para que filtre correctamente al instante
  const asignar = (idEfector) => {
    const seleccionado = disponibles.find(e => e.idEfector === idEfector);
    if (!seleccionado) return;
    
    setAsignados(prev => [...prev, seleccionado]);
    setDisponibles(prev => prev.filter(e => e.idEfector !== idEfector));
  };

  // Modificar la función quitar para devolverlo a disponibles al instante
  const quitar = (idEfector) => {
    const seleccionado = asignados.find(e => e.idEfector === idEfector);
    if (!seleccionado) return;

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
            const mensajeError = error.response?.data?.msg || 'No se pudo eliminar la asignación.';
            Swal.fire('Operación Denegada', mensajeError, 'error');
          });
      }
    });
  };

  const abrirModalReasignar = async (grupoOrigen) => {
    const auditoresDisponibles = usuarios.filter(u => u.idUsuario !== grupoOrigen.idUsuario);

    if (auditoresDisponibles.length === 0) {
      Swal.fire('Atención', 'No hay otros auditores disponibles para la reasignación.', 'warning');
      return;
    }

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
          {/* 📅 Selector de Período para filtrar los hospitales disponibles */}
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: '15px', bgcolor: '#fff', p: 2, borderRadius: 2, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#555' }}>
              📅 Filtrar Hospitales por Período:
            </Typography>
            <TextField
              select
              SelectProps={{ native: true }}
              value={periodoSeleccionado}
              onChange={(e) => setPeriodoSeleccionado(e.target.value)}
              variant="outlined"
              size="small"
              sx={{ minWidth: 200 }}
            >
              <option value="" disabled>Seleccione un período</option>
              {periodosDisponibles.map((p, idx) => (
                <option key={idx} value={p}>{p}</option>
              ))}
            </TextField>
          </Box>

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
                  {disponibles.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No hay hospitales con atenciones en este período.
                    </Typography>
                  ) : (
                    disponibles.map(h => (
                      <Tooltip key={h.idEfector} title={h.RazonSocial}>
                        <Chip
                          label={h.RazonSocial.length > 20 ? `${h.RazonSocial.slice(0, 20)}...` : h.RazonSocial}
                          onClick={() => asignar(h.idEfector)}
                          deleteIcon={<Add />}
                          onDelete={() => asignar(h.idEfector)}
                          sx={{ maxWidth: 220, cursor: 'pointer', mb: 1 }}
                        />
                      </Tooltip>
                    ))
                  )}
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
                        sx={{ maxWidth: 220, cursor: 'pointer', mb: 1 }}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          )}

          <Box display="flex" justifyContent="center" mt-="mt: 4">
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
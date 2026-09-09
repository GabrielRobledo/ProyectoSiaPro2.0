import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import API_URL from '../config';
import {
  Box,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Typography,
  Button,
  Stack,
  Paper,
  Chip,
} from '@mui/material';

import '../styles/cardsHosp.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const EstadisticasCierresAuditorias = () => {
  const [auditorias, setAuditorias] = useState([]);
  const [periodoFiltro, setPeriodoFiltro] = useState('');
  const [hospitalFiltro, setHospitalFiltro] = useState([]);
  const [cierres, setCierres] = useState([]);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?.idUsuario;
  const userRol = user?.rol.toLowerCase().trim();

  useEffect(() => {
    fetch(`${API_URL}/api/listarCierres`)
      .then(res => {
        if (!res.ok) throw new Error('No se pudo obtener los cierres');
        return res.json();
      })
      .then(data => {
        setCierres(data);
      })
      .catch(err => {
        console.error(err);
      });

    fetch( `${API_URL}/api/auditorias`)
      .then(res => {
        if (!res.ok) throw new Error('No se pudo obtener las auditorías');
        return res.json();
      })
      .then(data => {
        setAuditorias(data);
      })
      .catch(err => {
        console.error(err);
      });
  }, []);

  // Obtener periodos únicos
  const periodosUnicos = Array.from(
    new Set(auditorias.map(a => a.periodo))
  ).sort((a, b) => b.localeCompare(a));

// Obtener hospitales únicos filtrados por periodo seleccionado
  const hospitalesUnicos = Array.from(
    new Set(
      auditorias
        .filter(a => (periodoFiltro ? a.periodo === periodoFiltro : true))
        .map(a => a.Hospital)
    )
  ).sort();

  // Filtrar por periodo y hospital
    const auditoriasFiltradas = auditorias.filter(a => {
      const coincidePeriodo = periodoFiltro ? a.periodo === periodoFiltro : true;
      const coincideHospital = hospitalFiltro.length > 0 ? hospitalFiltro.includes(a.Hospital) : true;
      const coincideUsuario = userRol === 'administrador' ? true : String(a.idUsuario) === String(userId);

      return coincidePeriodo && coincideHospital && coincideUsuario;
    });

    const auditoriaCerrada = (idEfector, periodo) => {
        return cierres.some(
          (cierre) =>
            String(cierre.idEfector) === String(idEfector) &&
            String(cierre.periodo) === String(periodo)
        );
    };

    const exportarPDF = async () => {
      const cardsGrid = document.querySelector('.cards-grid');
      if (!cardsGrid) return;

      const canvas = await html2canvas(cardsGrid, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('auditorias.pdf');
    };



  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems="center"
        mb={3}
        flexWrap="wrap"
      >
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel id="select-periodo-label">Filtrar por periodo</InputLabel>
          <Select
            labelId="select-periodo-label"
            value={periodoFiltro}
            label="Filtrar por periodo"
            onChange={e => setPeriodoFiltro(e.target.value)}
          >
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            {periodosUnicos.map(periodo => (
              <MenuItem key={periodo} value={periodo}>
                {periodo}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 200 }} size="small">
        <InputLabel id="select-hospital-label">Filtrar por hospital</InputLabel>
        <Select
            labelId="select-hospital-label"
            multiple
            value={hospitalFiltro}
            onChange={e => setHospitalFiltro(e.target.value)}
            renderValue={selected => selected.join(', ')}
        >
            {hospitalesUnicos.map(hospital => (
            <MenuItem key={hospital} value={hospital}>
                <input
                type="checkbox"
                checked={hospitalFiltro.indexOf(hospital) > -1}
                readOnly
                />
                <span style={{ marginLeft: 8 }}>{hospital}</span>
            </MenuItem>
            ))}
        </Select>
        </FormControl>


        <Button
            variant="outlined"
            color="secondary"
            onClick={() => {
                setPeriodoFiltro('');
                setHospitalFiltro([]);
            }}
            >
            Limpiar filtros
        </Button>
        <Button
          variant="contained"
          backgroundColor="red"
          onClick={exportarPDF}
        >
          Exportar a PDF
        </Button>

      </Stack>

      {auditoriasFiltradas.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No hay auditorías para los filtros indicados.
        </Typography>
      ) : (
        <Box className="cards-grid">
          {auditoriasFiltradas.map(auditoria => {
            const { idAuditoria, Hospital, detalles, totalFacturado, totalDebito } = auditoria;

            const debitadas = detalles.filter(d => parseFloat(d.debito) > 0).length;
            const sinDebitar = detalles.filter(d => parseFloat(d.debito) === 0).length;
            const totalAtenciones = detalles.length;
            const porcentaje = totalAtenciones ? Math.round((debitadas / totalAtenciones) * 100) : 0;

            const data = {
              labels: ['Sin debitar', 'Debitadas'],
              datasets: [
                {
                  data: [sinDebitar, debitadas],
                  backgroundColor: ['#e0e0e0', '#f44336'],
                  borderWidth: 0,
                },
              ],
            };

            const options = {
              cutout: '70%',
              plugins: {
                legend: { display: true },
                tooltip: {
                  callbacks: {
                    label: ctx => `${ctx.label}: ${ctx.parsed}`,
                  },
                },
              },
            };

            return (
                <Paper
                key={idAuditoria}
                className="card"
                elevation={3}
                sx={{ p: 2, cursor: 'pointer', mb: 3 , position: 'relative'  }}
                onClick={() => navigate(`/auditorias/${idAuditoria}/detalle`)}
                >
                <Box display="flex" alignItems="center" mb={1}>
                  <LocalHospitalIcon color="primary" sx={{ mr: 1 }} />
                  <Typography
                    variant="h6"
                  >
                    {Hospital}
                  </Typography>
                </Box>
                <Typography variant="subtitle2" color="text.secondary" mb={2}>
                  Auditoría cerrada - Periodo: {auditoria.periodo}
                </Typography>

                {totalAtenciones > 0 && (
                  <>
                    <Box
                      sx={{ position: 'relative', width: 150, height: 150, mx: 'auto' }}
                    >
                      <Doughnut data={data} options={options} />
                      <Typography
                        variant="h5"
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          fontWeight: 'bold',
                        }}
                      >
                        {porcentaje}%
                      </Typography>
                    </Box>

                    <Box mt={2}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                        <CheckCircleOutlineIcon color="success" />
                        <Typography>Atenciones debitadas: {debitadas}</Typography>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                        <CancelOutlinedIcon color="error" />
                        <Typography>Atenciones sin debitar: {sinDebitar}</Typography>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                        <AttachMoneyIcon color="success" />
                        <Typography>
                        Total facturado: ${totalFacturado.toLocaleString()}
                        </Typography>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1}>
                        <MoneyOffIcon color="warning" />
                        <Typography>
                        Total débito: ${totalDebito.toLocaleString()}
                        </Typography>
                    </Stack>
                    </Box>
                  </>
                )}
                  <Chip
                    label={auditoriaCerrada(auditoria.idEfector, auditoria.periodo) ? 'Con cierre' : 'Sin cierre'}
                    color={auditoriaCerrada(auditoria.idEfector, auditoria.periodo) ? 'success' : 'warning'}
                    size="small"
                    sx={{ 
                      position: 'absolute', 
                      bottom: 8, 
                      right: 8 
                    }}
                    onClick={(e) => e.stopPropagation()} // evita que haga navigate al hacer clic en el chip
                  />
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default EstadisticasCierresAuditorias;

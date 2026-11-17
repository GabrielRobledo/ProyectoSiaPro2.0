import { useEffect, useState } from 'react';
import axios from 'axios';
import API_URL from '../config';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import KpiCard from './kipcards';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  FaClipboardList,
  FaMoneyBillWave,
  FaFileInvoiceDollar,
  FaCalculator,
} from 'react-icons/fa';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const ResumenAuditorias = () => {
  const [auditorias, setAuditorias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/auditorias`)
      .then((res) => {
        setAuditorias(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error al cargar auditorías', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <CircularProgress sx={{ mt: 4 }} />;

  const totalAuditorias = auditorias.length;
  const totalFacturado = auditorias.reduce((acc, a) => acc + (a.totalFacturado || 0), 0);
  const totalDebito = auditorias.reduce((acc, a) => acc + (a.totalDebito || 0), 0);
  const totalNeto = totalFacturado - totalDebito;

  const labels = auditorias.map((a) => a.Hospital);
  const dataFacturado = auditorias.map((a) => a.totalFacturado || 0);
  const dataDebito = auditorias.map((a) => a.totalDebito || 0);

  return (
    <Box sx={{ mt: 4, px: 2 }}>
      <Typography variant="h5" gutterBottom color="primary">
        📋 Resumen de Auditorías
      </Typography>

      {/* KPIs */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        <KpiCard
          icon={FaClipboardList}
          title="Cantidad de Auditorías"
          value={totalAuditorias}
          color="#6f42c1"
        />
        <KpiCard
          icon={FaMoneyBillWave}
          title="Total Facturado"
          value={`$${totalFacturado.toLocaleString()}`}
          color="#28a745"
        />
        <KpiCard
          icon={FaFileInvoiceDollar}
          title="Total Débito"
          value={`$${totalDebito.toLocaleString()}`}
          color="#dc3545"
        />
        <KpiCard
          icon={FaCalculator}
          title="Total Neto"
          value={`$${totalNeto.toLocaleString()}`}
          color="#007bff"
        />
      </Box>

      {/* Contenedor para gráfico y tabla lado a lado */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 4,
          alignItems: 'flex-start',
          mb: 4,
        }}
      >
        {/* Gráfico */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" gutterBottom>
            📊 Comparativa Facturado vs Débito por Hospital
          </Typography>
          <Bar
            data={{
              labels,
              datasets: [
                {
                  label: 'Facturado',
                  data: dataFacturado,
                  backgroundColor: 'rgba(40, 167, 69, 0.7)',
                  borderColor: '#28a745',
                  borderWidth: 1,
                },
                {
                  label: 'Débito',
                  data: dataDebito,
                  backgroundColor: 'rgba(220, 53, 69, 0.7)',
                  borderColor: '#dc3545',
                  borderWidth: 1,
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'bottom' },
                tooltip: { mode: 'index', intersect: false },
              },
              scales: {
                x: {
                  beginAtZero: true,
                  ticks: { font: { size: 12 } },
                },
                y: {
                  ticks: { font: { size: 12 } },
                  // maxRotation: 0, // para que no roten las etiquetas en eje Y
                },
              },
            }}
            height={130}
          />
        </Box>

        {/* Tabla */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" gutterBottom>
            📑 Últimas Auditorías Registradas
          </Typography>
          <Paper
            elevation={3}
            sx={{
              overflowX: 'auto',
              borderRadius: 2,
              bgcolor: '#fff',
              p: 2,
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
            <thead>
              <tr style={{ backgroundColor: '#1976d2', color: 'white' }}>
                <th style={thStyle}>Hospital</th>
                <th style={thStyle}>Periodo</th>
                <th style={thStyle}>Facturado</th>
                <th style={thStyle}>Débito</th>
                <th style={thStyle}>Neto</th>
              </tr>
            </thead>
            <tbody>
              {auditorias
                .slice()
                .sort((a, b) => b.idAuditoria - a.idAuditoria)
                .slice(0, 5)
                .map((a, idx) => (
                  <tr
                    key={a.idAuditoria}
                    style={{
                      backgroundColor: idx % 2 === 0 ? '#f9f9f9' : '#fff',
                    }}
                  >
                    <td style={tdStyle}>{a.Hospital}</td>
                    <td style={tdStyle}>{a.periodo}</td>
                    <td style={tdStyle}>${(a.totalFacturado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td style={tdStyle}>${(a.totalDebito || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td style={tdStyle}>
                      ${(a.totalFacturado - a.totalDebito).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
            </tbody>
            </table>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid #ddd',
  whiteSpace: 'nowrap',
};

export default ResumenAuditorias;

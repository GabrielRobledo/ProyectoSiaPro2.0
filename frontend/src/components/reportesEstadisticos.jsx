import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import API_URL from '../config';
import { Bar } from 'react-chartjs-2';
import { ChartComponent, SeriesCollectionDirective, SeriesDirective,
         Inject, StackingAreaSeries, Category, Legend as SfLegend, Tooltip as SfTooltip, DataLabel, Chart3D } from '@syncfusion/ej2-react-charts';
import { Dialog, IconButton } from "@mui/material";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import CloseIcon from "@mui/icons-material/Close";


// Chart.js setup
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement
);

// Icons
import {
  FaClipboardCheck,
  FaHospital,
  FaUserInjured,
  FaUsers,
  FaMoneyBillWave,
  FaFileInvoiceDollar,
  FaCoins
} from 'react-icons/fa';

const Reportes = () => {
  const [cierres, setCierres] = useState([]);
  const [auditorias, setAuditorias] = useState([]);
  const [periodo, setPeriodo] = useState("");
  const [atenciones, setAtenciones] = useState([]);
  const [graficoExpandido, setGraficoExpandido] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/api/listarCierres`)
      .then(res => setCierres(res.data))
      .catch(console.error);
    axios.get(`${API_URL}/api/auditorias`)
      .then(res => setAuditorias(res.data))
      .catch(console.error);
    axios.get(`${API_URL}/api/atencionesTotales`)
      .then(res => setAtenciones(res.data))
      .catch(console.error);
  }, []);

  const periodosDisponibles = useMemo(() => {
    return Array.from(new Set(cierres.map(c => c.periodo)));
  }, [cierres]);

  const auditoriasFiltradas = useMemo(() => {
    return periodo
      ? auditorias.filter(a => a.periodo === periodo)
      : auditorias;
  }, [auditorias, periodo]);

  // ✅ KPI cálculos:
  const numAuditorias = auditoriasFiltradas.length;
  const numHospitales = new Set(auditoriasFiltradas.map(a => a.Hospital)).size;
  const numAtenciones = auditoriasFiltradas.reduce(
    (sum, a) => sum + (a.detalles?.length || 0),
    0
  );

  const idsAtencion = useMemo(() => {
    return auditoriasFiltradas.flatMap(a =>
      a.detalles?.map(d => d.idAtencion) || []
    );
  }, [auditoriasFiltradas]);

  const atencionesFiltradas = useMemo(() => {
    return atenciones.filter(a => idsAtencion.includes(a.idAtencion));
  }, [atenciones, idsAtencion]);


  const numPacientes = useMemo(() => {
    return new Set(atencionesFiltradas.map(a => a.idBeneficiario)).size;
  }, [atencionesFiltradas]);

  // 🏥 Tabla por hospital:
  const resumenPorHospital = useMemo(() => {
    const acc = {};
    auditoriasFiltradas.forEach(a => {
      const h = a.Hospital;
      if (!acc[h]) acc[h] = { facturado: 0, debito: 0 };
      acc[h].facturado += parseFloat(a.totalFacturado) || 0;
      acc[h].debito += parseFloat(a.totalDebito) || 0;
    });
    return Object.entries(acc).map(([Hospital, v]) => ({
      Hospital,
      totalFacturado: v.facturado,
      totalDebitado: v.debito,
      totalNeto: v.facturado - v.debito
    }));
  }, [auditoriasFiltradas]);

   const sf3dData = resumenPorHospital.map(r => ({
    Hospital: r.Hospital,
    Facturado: r.totalFacturado,
    Debitado: r.totalDebitado
  }));

  const totalFacturado = resumenPorHospital.reduce((sum, h) => sum + h.totalFacturado, 0);
  const totalDebitado = resumenPorHospital.reduce((sum, h) => sum + h.totalDebitado, 0);

  // 📊 Gráfico 2: atenciones débito vs sin débito
  const barData = {
    labels: resumenPorHospital.map(r => r.Hospital),
    datasets: [
      {
        label: "Con Débito",
        data: resumenPorHospital.map(r => 
          auditoriasFiltradas
            .filter(a => a.Hospital === r.Hospital)
            .reduce((s, a) =>
              s + (a.detalles?.filter(d => d.debito > 0).length || 0),
            0)
        ),
        backgroundColor: "rgba(255, 99, 132, 0.7)"
      },
      {
        label: "Sin Débito",
        data: resumenPorHospital.map(r => 
          auditoriasFiltradas
            .filter(a => a.Hospital === r.Hospital)
            .reduce((s, a) =>
              s + (a.detalles?.filter(d => d.debito === 0).length || 0),
            0)
        ),
        backgroundColor: "rgba(54, 162, 235, 0.7)"
      }
    ]
  };

  

 return (
    <div style={{ padding: 20, fontFamily: "'Roboto', sans-serif", backgroundColor: "#f0f2f5", minHeight: "100vh" }}>
      <h2 style={{ marginBottom: 20 }}>🏥 Dashboard Auditorías</h2>

      {/* Contenedor selector + KPIs */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 20,
        marginBottom: 30
      }}>
        {/* Selector periodo */}
        <div style={{ minWidth: 150 }}>
          <label htmlFor="periodo" style={{ fontWeight: "600" }}>Periodo:</label>
          <select
            id="periodo"
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            style={{
              marginLeft: 10,
              padding: 6,
              borderRadius: 4,
              border: "1px solid #ccc",
              minWidth: 100,
              fontSize: 14
            }}
          >
            <option value="">-- Todos --</option>
            {periodosDisponibles.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 600 }}>
          {[ {
            title: "Total Facturado",
            value: `$${totalFacturado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
            icon: <FaMoneyBillWave size={28} color="#3f51b5" />
          }, {
            title: "Total Debitado",
            value: `$${totalDebitado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
            icon: <FaFileInvoiceDollar size={28} color="#e53935" />
          }, 
            {
            title: "Auditorías",
            value: numAuditorias,
            icon: <FaClipboardCheck size={28} color="#4caf50" />
          }, {
            title: "Hospitales",
            value: numHospitales,
            icon: <FaHospital size={28} color="#2196f3" />
          }, {
            title: "Atenciones",
            value: numAtenciones,
            icon: <FaUserInjured size={28} color="#ff9800" />
          }, {
            title: "Pacientes",
            value: numPacientes,
            icon: <FaUsers size={28} color="#9c27b0" />
          }].map(({ title, value, icon }) => (
            <div key={title} style={{
              background: "#fff",
              padding: "15px 20px",
              borderRadius: 8,
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              minWidth: 120,
              display: "flex",
              alignItems: "center",
              gap: 15
            }}>
              <div>{icon}</div>
              <div style={{ textAlign: "left" }}>
                <h4 style={{ margin: 0, fontSize: 14, color: "#999" }}>{title}</h4>
                <p style={{ fontSize: "1.8rem", margin: "5px 0 0", fontWeight: "700", color: "#222" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contenedor tabla + gráficos */}
      <div style={{
        display: "flex",
        gap: 20,
        flexWrap: "wrap",
        alignItems: "flex-start"
      }}>
        {/* Tabla resumen */}
        <div style={{
          flex: "2 1 600px",
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          padding: 20,
          minWidth: 300,
          overflowX: "auto"
        }}>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Hospital", "Total Facturado", "Total Debitado", "Total Neto"].map(h => (
                  <th
                    key={h}
                    style={{
                      borderBottom: "2px solid #ddd",
                      padding: "10px",
                      textAlign: "left",
                      color: "#555",
                      fontWeight: "600",
                      fontSize: 14
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumenPorHospital.map(r => (
                <tr key={r.Hospital} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px" }}>{r.Hospital}</td>
                  <td style={{ padding: "10px" }}>
                    ${r.totalFacturado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "10px" }}>
                    ${r.totalDebitado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "10px" }}>
                    ${r.totalNeto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* Gráficos apilados */}
      <div style={{
        flex: "1 1 350px",
        display: "flex",
        flexDirection: "column",
        gap: 30,
        minWidth: 300
      }}>
        {/* Gráfico 1 - Facturado vs Débito */}
        <div style={{
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          padding: 20,
          height: 320,
          position: "relative"
        }}>
          <h4 style={{ marginBottom: 10 }}>Facturado vs Débito</h4>
          <IconButton
            size="small"
            onClick={() => setGraficoExpandido("facturado")}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              backgroundColor: "#fff"
            }}
          >
            <ZoomOutMapIcon fontSize="small" />
          </IconButton>
          <ChartComponent
            id="chart3d"
            primaryXAxis={{ valueType: 'Category', title: 'Hospital' }}
            primaryYAxis={{ title: 'Monto ($)' }}
            chartArea={{ border: { width: 0 } }}
            tooltip={{ enable: true, shared: true }}
            title="Facturado vs Débito por Hospital"
            enable3D={true}
            width="100%"
            height="100%"
            legendSettings={{ visible: true }}
          >
            <Inject services={[StackingAreaSeries, Category, SfLegend, SfTooltip, DataLabel, Chart3D]} />
            <SeriesCollectionDirective>
              <SeriesDirective
                dataSource={sf3dData}
                xName="Hospital"
                yName="Facturado"
                name="Facturado"
                type="Area"
                opacity={0.6}
              />
              <SeriesDirective
                dataSource={sf3dData}
                xName="Hospital"
                yName="Debitado"
                name="Debitado"
                type="Area"
                opacity={0.6}
              />
            </SeriesCollectionDirective>
          </ChartComponent>
        </div>

        {/* Gráfico 2 - Atenciones Con vs Sin Débito */}
        <div style={{
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          padding: 20,
          height: 320,
          position: "relative",
          display: "flex",
          flexDirection: "column"
        }}>
          <h4 style={{ marginBottom: 10 }}>Atenciones: Con vs Sin Débito</h4>
          <IconButton
            size="small"
            onClick={() => setGraficoExpandido("atenciones")}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              backgroundColor: "#fff"
            }}
          >
            <ZoomOutMapIcon fontSize="small" />
          </IconButton>
          <div style={{ flexGrow: 1 }}>
            <Bar data={barData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Modal de ampliación */}
      <Dialog
        open={!!graficoExpandido}
        onClose={() => setGraficoExpandido(null)}
        maxWidth="md"
        fullWidth
      >
        <div style={{ padding: 20, position: "relative" }}>
          <IconButton
            onClick={() => setGraficoExpandido(null)}
            style={{ position: "absolute", top: 10, right: 10 }}
          >
            <CloseIcon />
          </IconButton>
          <h3 style={{ marginBottom: 10 }}>
            {graficoExpandido === "facturado"
              ? "Facturado vs Débito"
              : "Atenciones Con vs Sin Débito"}
          </h3>
          <div style={{ height: 400 }}>
            {graficoExpandido === "facturado" ? (
              <ChartComponent
                id="chart3d-expanded"
                primaryXAxis={{ valueType: 'Category', title: 'Hospital' }}
                primaryYAxis={{ title: 'Monto ($)' }}
                chartArea={{ border: { width: 0 } }}
                tooltip={{ enable: true, shared: true }}
                title="Facturado vs Débito por Hospital"
                enable3D={true}
                width="100%"
                height="100%"
                legendSettings={{ visible: true }}
              >
                <Inject services={[AreaSeries, Category, SfLegend, SfTooltip, DataLabel, Chart3D]} />
                <SeriesCollectionDirective>
                  <SeriesDirective
                    dataSource={sf3dData}
                    xName="Hospital"
                    yName="Facturado"
                    name="Facturado"
                    type="Area"
                    opacity={0.6}
                  />
                  <SeriesDirective
                    dataSource={sf3dData}
                    xName="Hospital"
                    yName="Debitado"
                    name="Debitado"
                    type="Area"
                    opacity={0.6}
                  />
                </SeriesCollectionDirective>
              </ChartComponent>
            ) : (
              <Bar data={barData} options={{ maintainAspectRatio: false }} />
            )}
          </div>
        </div>
      </Dialog>

      </div>
    </div>
  );


}
export default Reportes;

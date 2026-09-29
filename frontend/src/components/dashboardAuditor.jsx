  import { useEffect, useState, useMemo } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { useUser } from './contextUsers';
  import Swal from 'sweetalert2';
  import { FiClipboard, FiDollarSign, } from 'react-icons/fi';
  import { FaHospital, FaTasks, FaClipboard  } from 'react-icons/fa';
  import API_URL from '../config';

  export default function DashboardAuditor() {
    const [auditorias, setAuditorias] = useState([]);
    const [atenciones, setAtenciones] = useState([]);
    const { user } = useUser();
    const navigate = useNavigate();
    const [cierres, setCierres] = useState([]);
    const [novedades, setNovedades] = useState([]);
    const [mostrarNovedades, setMostrarNovedades] = useState(true);
    const [asignacionesSinAuditoria, setAsignacionesSinAuditoria] = useState([]);
    const [auditoriasEnCurso, setAuditoriasEnCurso] = useState([]);
    const [periodoSeleccionado, setPeriodoSeleccionado] = useState('TODOS');


    useEffect(() => {
      fetch(`${API_URL}/api/auditorias`)
        .then(res => res.json())
        .then(data => {
          const { idUsuario } = user || {};
          const filtradas = idUsuario ? data.filter(a => String(a.idUsuario) === String(idUsuario)) : data;
          setAuditorias(filtradas);
        })
        .catch(err => Swal.fire('Error', err.message, 'error'));

      fetch( `${API_URL}/api/atenciones`)
        .then(res => res.json())
        .then(setAtenciones)
        .catch(err => Swal.fire('Error', err.message, 'error'));
      fetch(`${API_URL}/api/listarCierres`)
        .then(res => res.json())
        .then(setCierres)
        .catch(err => Swal.fire('Error', err.message, 'error'));
    }, [user]);

   useEffect(() => {
      if (!user || !user.idUsuario) return;

      fetch(`${API_URL}/api/auditorias-en-progreso/${user.idUsuario}`)
        .then(res => res.json())
        .then(setAuditoriasEnCurso)
        .catch(err => console.error("Error cargando auditorías en curso:", err));
    }, [user]); 

  useEffect(() => {
    console.log("user en asignaciones-sin-auditoria:", user);

    if (!user || !user.idUsuario) {
      console.log("Esperando a que el usuario esté definido...");
      return;
    }

    fetch(`${API_URL}/api/asignaciones-sin-auditoria/${user.idUsuario}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setAsignacionesSinAuditoria(data);
      })
      .catch(err => {
        console.error("Error cargando asignaciones sin auditoría:", err);
        Swal.fire('Error', err.message, 'error');
      });
  }, [user]);



  // Función auxiliar para transformar fechas tipo '10-AUG-24' a '2024-08'
  const convertirFechaAPeriodo = (fechaStr) => {
    if (!fechaStr) return null;
    // Si ya viene en formato YYYY-MM
    if (/^\d{4}-\d{2}$/.test(fechaStr)) return fechaStr;
    // Si viene en formato tipo '10-AUG-24'
    const partes = fechaStr.split('-');
    if (partes.length === 3) {
      const [dia, mesTexto, anioDosDigitos] = partes;
      const meses = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
        'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
      };
      const mesNum = meses[mesTexto.toUpperCase()];
      const anioCompleto = `20${anioDosDigitos}`;
      if (mesNum) {
        return `${anioCompleto}-${mesNum}`;
      }
    }
    // Por si acaso viene en formato YYYY-MM-DD
    return fechaStr.slice(0, 7);
  };

  // 2. Extraer periodos únicos EXCLUSIVAMENTE de la tabla atenciones
  const periodosDisponibles = useMemo(() => {
    const setP = new Set(
      atenciones.map(a => convertirFechaAPeriodo(a.fecha)).filter(Boolean)
    );
    return Array.from(setP).sort().reverse();
  }, [atenciones]);

  // 3. Filtrar atenciones y auditorías según el periodo seleccionado
  const atencionesFiltradasPeriodo = useMemo(() => {
    if (periodoSeleccionado === 'TODOS') return atenciones;
    return atenciones.filter(a => convertirFechaAPeriodo(a.fecha) === periodoSeleccionado);
  }, [atenciones, periodoSeleccionado]);

    const auditoriaCerrada = (idEfector, periodo) => {
      return cierres.some(
        (cierre) =>
          String(cierre.idEfector) === String(idEfector) &&
          String(cierre.periodo) === String(periodo)
      );
    };
    

    const totalDebito = auditorias.reduce((acc, a) => acc + (parseFloat(a.totalDebito) || 0), 0);
    const auditoriasRecientes = auditorias
    .slice() // para no mutar el estado original
    .sort((a, b) => b.idAuditoria - a.idAuditoria)
    .slice(0, 5);

    // DEBUG: Mostrar qué trae cada endpoint
    console.log('Asignaciones sin auditoría:', asignacionesSinAuditoria);
    console.log('Ejemplo atencion:', atenciones[0]);

    // Forzar comparación como string para evitar problemas de tipo
    const efectoresPendientes = new Set(
      asignacionesSinAuditoria.map(a => String(a.idEfector)).filter(Boolean)
    );

    const atencionesFiltradas = atenciones.filter(a =>
      efectoresPendientes.has(String(a.idEfector))
    );

    const atencionesPorTipo = atencionesFiltradas.reduce((acc, a) => {
      if (a.tipoAtencion) {
        acc[a.tipoAtencion] = (acc[a.tipoAtencion] || 0) + 1;
      }
      return acc;
    }, {});


    
    useEffect(() => {
      fetch(`${API_URL}/api/novedades`)
        .then(res => res.json())
        .then(data => {
          if (data.length > 0) {
            setNovedades(data);
          } else {
            setMostrarNovedades(false);
          }
        })
        .catch(err => {
          console.error('Error cargando novedades:', err);
          setMostrarNovedades(false);
        });
    }, []);

    return (
      <div style={containerStyle}>
        {/* Selector Global de Período basado en Atenciones */}
        <div style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px', background: '#fff', padding: '15px 20px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontWeight: 'bold', color: '#555' }}>📅 Período de Atenciones:</span>
          <select 
            value={periodoSeleccionado} 
            onChange={(e) => setPeriodoSeleccionado(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', minWidth: '180px' }}
          >
            <option value="TODOS">Todos los períodos</option>
            {periodosDisponibles.map((p, idx) => (
              <option key={idx} value={p}>{p}</option>
            ))}
          </select>
        </div>
        {mostrarNovedades && novedades.length > 0 && (
          <div style={novedadesBannerStyle}>
            <div style={{ flex: 1 }}>
              <strong>{novedades[0].titulo}</strong>: {novedades[0].mensaje}
            </div>
            <button
              onClick={() => setMostrarNovedades(false)}
              style={cerrarBtnStyle}
              aria-label="Cerrar novedades"
            >
              ×
            </button>
          </div>
        )}
        <div style={dashboardRow}>
          <div style={cardBlock}>
            <h2 style={sectionTitle}>Auditorías Cerradas</h2>
            <div style={cardsContainer}>
              <div style={{ ...cardStyle, borderLeft: '5px solid #1976d2' }} onClick={() => navigate(`/estadisticasCierres`)}>
                <FaTasks size={32} color="#1976d2" />
                <h3>Total Auditorías</h3>
                <p style={valueStyle}>{auditorias.length}</p>
              </div>

              <div style={{ ...cardStyle, borderLeft: '5px solid #2e7d32' }}>
                <FiDollarSign size={32} color="#2e7d32" />
                <h3>Total Débito</h3>
                <p style={valueStyle}>${totalDebito.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div style={{ ...cardBlock, flex: '1 1 50%', maxWidth: '300px' }}>
            <h2 style={sectionTitle}>Auditorías en Curso</h2>
            <div style={cardsContainer}>
              <div style={{ ...cardStyle, borderLeft: '5px solid #0288d1' }} onClick={() => navigate(`/auditoriasParciales`)}>
                <FaClipboard size={32} color="#0288d1" />
                <h3>En Curso</h3>
                <p style={valueStyle}>{auditoriasEnCurso.length}</p>
              </div>
            </div>
          </div>

          <div style={cardBlock}>
            <h2 style={sectionTitle}>Atenciones Pendientes</h2>
            <div style={cardsContainer}>
              <div style={{ ...cardStyle, borderLeft: '5px solid #f57c00' }} onClick={() => navigate(`/registros/atenciones`)}>
                <FaHospital size={32} color="#f57c00" />
                <h3>Hospitales Pendientes</h3>
                <p style={valueStyle}>{ new Set(asignacionesSinAuditoria.map(a => a.idEfector)).size}</p>

              </div>

              <div style={{ ...cardStyle, borderLeft: '5px solid #c2185b' }}>
                <FiClipboard size={32} color="#c2185b" />
                <h3>Atenciones por Tipo</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {Object.entries(atencionesPorTipo).length === 0 ? (
                    <li>No hay atenciones pendientes.</li>
                  ) : (
                    Object.entries(atencionesPorTipo).map(([tipo, count]) => (
                      <li key={tipo}><strong>{tipo}:</strong> {count}</li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* === Tabla mejorada === */}
        <h2 style={{ marginTop: '40px' }}>Últimas Auditorías Cerradas</h2>
        <div style={{
          overflowX: 'auto',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          backgroundColor: '#fff',
          marginTop: '10px'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: '600px'
          }}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Hospital</th>
                <th style={thStyle}>Periodo</th>
                <th style={thStyle}>Total Débito</th>
                <th style={thStyle}>Estado</th> 
              </tr>
            </thead>
            <tbody>
              {auditoriasRecientes.map((a, idx) => {
                const estaCerrada = auditoriaCerrada(a.idEfector, a.periodo);

                return (
                  <tr
                    key={a.idAuditoria}
                    style={{
                      backgroundColor: idx % 2 === 0 ? '#f5f5f5' : '#fff',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e3f2fd')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#f5f5f5' : '#fff')}
                  >
                    <td style={tdStyle}>{a.idAuditoria}</td>
                    <td style={tdStyle}>{a.Hospital}</td>
                    <td style={tdStyle}>{a.periodo}</td>
                    <td style={tdStyle}>${parseFloat(a.totalDebito).toFixed(2)}</td>
                    <td style={tdStyle}>
                      {estaCerrada ? (
                        <span style={chipStyle}>Cerrado</span>
                      ) : (
                        <span style={chipStyle2}>Pendiente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          onClick={() => navigate('/auditorias')}
          style={buttonStyle}
        >
          Ver todas las auditorías
        </button>
      </div>
    );
  }

  // === Estilos inline ===

  const containerStyle = {
    padding: '40px',
    fontFamily: 'Arial, sans-serif',
    color: '#333',
    backgroundColor: '#f9f9f9',
    minHeight: '100vh'
  };

  const dashboardRow = {
    display: 'flex',
    gap: '30px',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: '40px'
  };

  const cardBlock = {
    flex: '1 1 30%',
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    minWidth: '250px',
  };

  const sectionTitle = {
    fontSize: '1.2rem',
    marginBottom: '20px',
    color: '#444'
  };

  const cardsContainer = {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap'
  };

  const cardStyle = {
    flex: '1 1 250px',
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    transition: 'transform 0.3s',
  };

  const valueStyle = {
    fontSize: '2rem',
    fontWeight: 'bold',
    margin: '10px 0 0'
  };

  const thStyle = {
    backgroundColor: '#1976d2',
    color: '#fff',
    textAlign: 'left',
    padding: '12px 16px'
  };

  const tdStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0'
  };

  const buttonStyle = {
    marginTop: '30px',
    padding: '12px 24px',
    backgroundColor: '#1976d2',
    color: '#fff',
    fontSize: '1rem',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background 0.3s'
  };

  const chipStyle = {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '15px',
    backgroundColor: '#4caf50',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '0.8rem',
    userSelect: 'none'
  };

  const chipStyle2 = {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '15px',
    backgroundColor: '#f44336',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '0.8rem',
    userSelect: 'none'
  };

  const novedadesBannerStyle = {
    backgroundColor: '#fffae6',
    color: '#665c00',
    border: '1px solid #ffecb3',
    borderRadius: '5px',
    padding: '12px 20px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '1rem',
    boxShadow: '0 2px 6px rgba(255, 193, 7, 0.3)',
  };

  const cerrarBtnStyle = {
    background: 'transparent',
    border: 'none',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    color: '#665c00',
    lineHeight: '1',
    padding: '0 6px',
  };
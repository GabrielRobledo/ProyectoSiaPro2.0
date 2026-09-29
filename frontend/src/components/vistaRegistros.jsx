import { useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import TablaConFiltro from './tabla';
import ListadoHospitales from '../components/listaHospitales';
import API_URL from '../config';
import { useUser } from './contextUsers';

const VistaRegistros = ({ editarAuditoria = false }) => {
  const { tipo, id } = useParams();
  const [searchParams] = useSearchParams();
  const hospitalFiltro = searchParams.get('hospital');

  const [datos, setDatos] = useState([]);
  const [hospitales, setHospitales] = useState([]);
  const { user } = useUser();
  const [pendientes, setPendientes] = useState([]);

  // 📅 Nuevo estado para el período seleccionado
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('TODOS');

  // 🔄 Traer hospitales pendientes de auditar asignados al auditor
  useEffect(() => {
    if (user?.idUsuario) {
      fetch(`${API_URL}/api/asignaciones-sin-auditoria/${user.idUsuario}`)
        .then(res => res.json())
        .then(data => setPendientes(data))
        .catch(err => {
          setPendientes([]);
          console.error('Error al obtener hospitales pendientes:', err);
        });
    }
  }, [user]);

  // 🔄 Traer listado de hospitales (efectores)
  useEffect(() => {
    fetch(`${API_URL}/api/efectores`)
      .then(res => {
        if (!res.ok) throw new Error('Error al obtener hospitales');
        return res.json();
      })
      .then(json => setHospitales(json))
      .catch(err => {
        console.error('Error cargando hospitales:', err);
        setHospitales([]); // fallback vacío para evitar más errores
      });
  }, []);

  // 🔁 Si está en modo edición de auditoría, traemos auditoría por ID
  useEffect(() => {
    if (editarAuditoria) {
      fetch(`${API_URL}/api/auditorias/${id}`)
        .then(res => {
          if (!res.ok) throw new Error('Error al obtener auditoría');
          return res.json();
        })
        .then((auditoria) => {
          console.log('AUDITORIA RECIBIDA:', auditoria);

          if (Array.isArray(auditoria?.detalles)) {
            const datosConExtras = auditoria.detalles.map((d) => ({
              ...d,
              idEfector: auditoria.idEfector,
              periodo: auditoria.periodo,
            }));
            setDatos(datosConExtras);
          } else {
            console.warn('La auditoría no contiene detalles válidos.');
            setDatos([]);
          }
        })
        .catch((err) => {
          console.error('Error al cargar auditoría:', err);
          setDatos([]);
        });
    } else if (tipo) {
      fetch(`${API_URL}/api/${tipo}`)
        .then(res => {
          if (!res.ok) throw new Error('Error al obtener datos');
          return res.json();
        })
        .then(json => setDatos(json))
        .catch(err => {
          console.error('Error al cargar datos:', err);
          setDatos([]);
        });
    }
  }, [tipo, editarAuditoria, id]);

  // Función auxiliar para transformar fechas (ej: '15-AUG-24' o 'YYYY-MM') a 'YYYY-MM'
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

  // 📅 Extraer períodos únicos de los datos cargados
  const periodosDisponibles = useMemo(() => {
    const setP = new Set(
      datos.map(d => d.periodo || convertirFechaAPeriodo(d.fecha)).filter(Boolean)
    );
    return Array.from(setP).sort().reverse();
  }, [datos]);

  // 🔍 Filtro combinado por hospital y por período
  const datosFiltrados = useMemo(() => {
    let resultado = datos;

    if (hospitalFiltro) {
      resultado = resultado.filter(d =>
        d.idEfector &&
        String(d.idEfector).toLowerCase() === String(hospitalFiltro).toLowerCase()
      );
    }

    if (periodoSeleccionado !== 'TODOS') {
      resultado = resultado.filter(d => {
        const pItem = d.periodo || convertirFechaAPeriodo(d.fecha);
        return String(pItem) === String(periodoSeleccionado);
      });
    }

    return resultado;
  }, [datos, hospitalFiltro, periodoSeleccionado]);

  // 🏥 Mostrar nombre del hospital
  const nombreHospital = useMemo(() => {
    if (!hospitalFiltro || hospitales.length === 0) return null;
    const h = hospitales.find(hosp =>
      String(hosp.idEfector).toLowerCase() === String(hospitalFiltro).toLowerCase()
    );
    return h?.RazonSocial || null;
  }, [hospitalFiltro, hospitales]);

  // 🖥️ Si es vista general de atenciones sin filtro
  if (!editarAuditoria && tipo === 'atenciones' && !hospitalFiltro) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Hospitales pendientes de auditar</h2>
        {/* 🛠️ CORRECCIÓN: Usamos estrictamente 'pendientes'. Si el array está vacío, se mostrará vacío y no recurrirá a datos generales */}
        {pendientes.length === 0 && <p>No hay hospitales pendientes de auditar.</p>}
        <ListadoHospitales atenciones={Array.isArray(pendientes) ? pendientes : []} />
      </div>
    );
  }

  // 📋 Vista principal de registros (listado o edición)
  return (
    <div style={{ padding: '20px' }}>
      <h2>
        {editarAuditoria
          ? 'Editar Auditoría'
          : tipo
            ? `Listado de ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`
            : 'Listado'
        }
        {hospitalFiltro && nombreHospital && ` - Hospital: ${nombreHospital}`}
      </h2>

      {/* 📅 Selector de Filtro por Período */}
      <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '15px', background: '#fff', padding: '12px 18px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', maxWidth: '400px' }}>
        <span style={{ fontWeight: 'bold', color: '#555', fontSize: '14px' }}>📅 Período:</span>
        <select 
          value={periodoSeleccionado} 
          onChange={(e) => setPeriodoSeleccionado(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', flex: 1 }}
        >
          <option value="TODOS">Todos los períodos</option>
          {periodosDisponibles.map((p, idx) => (
            <option key={idx} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <TablaConFiltro
        datos={datosFiltrados}
        setDatos={setDatos}
        tipo={tipo || 'atenciones'}
        editarAuditoriaId={editarAuditoria ? id : null}
      />
    </div>
  );
};

export default VistaRegistros;
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

  // 📅 Estado para el período seleccionado
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');

  // 🔄 Traer hospitales pendientes de auditar asignados al auditor
  useEffect(() => {
    if (user?.idUsuario) {
      fetch(`${API_URL}/api/asignaciones-sin-auditoria/${user.idUsuario}`)
        .then(res => res.json())
        .then(data => {
          // 🧪 [PRUEBA] Inyectamos un elemento con período ficticio para testear
          const datosConPrueba = [
            ...data,
            { idEfector: 999, RazonSocial: 'HOSPITAL FICTICIO DE PRUEBA', periodo: '2026-12', fecha: '15-DEC-26' }
          ];
          setPendientes(datosConPrueba);
        })
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
        setHospitales([]);
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
          if (Array.isArray(auditoria?.detalles)) {
            const datosConExtras = auditoria.detalles.map((d) => ({
              ...d,
              idEfector: auditoria.idEfector,
              periodo: auditoria.periodo,
            }));
            setDatos(datosConExtras);
          } else {
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
        .then(json => setDatos(json)) // 👈 Aquí ya no inyectamos nada, va directo el json real
        .catch(err => {
          console.error('Error al cargar datos:', err);
          setDatos([]);
        });
    }
  }, [tipo, editarAuditoria, id]);

  // Función auxiliar para transformar fechas a 'YYYY-MM'
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

  // 📅 Extraer períodos únicos (incluyendo el ficticio de prueba)
  const periodosDisponibles = useMemo(() => {
    const fuenteDatos = (!editarAuditoria && tipo === 'atenciones' && !hospitalFiltro) ? pendientes : datos;
    const setP = new Set(
      fuenteDatos.map(d => d.periodo || convertirFechaAPeriodo(d.fecha)).filter(Boolean)
    );
    return Array.from(setP).sort().reverse();
  }, [pendientes, datos, editarAuditoria, tipo, hospitalFiltro]);

  // 🔍 Filtrar pendientes por período
    const pendientesFiltrados = useMemo(() => {
      if (periodoSeleccionado === '') return [];
      if (periodoSeleccionado === 'TODOS') return pendientes;
      return pendientes.filter(p => {
        const pItem = p.periodo || convertirFechaAPeriodo(p.fecha);
        return String(pItem) === String(periodoSeleccionado);
      });
    }, [pendientes, periodoSeleccionado]);

  // 🔍 Filtrar datos generales/tabla por hospital y período
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

        {/* 📅 Selector de Período */}
        <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '15px', background: '#fff', padding: '12px 18px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', maxWidth: '400px' }}>
          <span style={{ fontWeight: 'bold', color: '#555', fontSize: '14px' }}>📅 Período:</span>
          <select 
            value={periodoSeleccionado} 
            onChange={(e) => setPeriodoSeleccionado(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', flex: 1 }}
          >
            <option value="">Seleccione un período...</option>
            <option value="TODOS">Todos los períodos</option>
            {periodosDisponibles.map((p, idx) => (
              <option key={idx} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Mensaje condicional según la selección */}
        {periodoSeleccionado === '' ? (
          <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px dashed #ccc', color: '#666', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '15px' }}>Por favor, seleccione un período para visualizar los hospitales pendientes de auditar.</p>
          </div>
        ) : (
          <>
            {pendientesFiltrados.length === 0 && <p>No hay hospitales pendientes para el período seleccionado.</p>}
            <ListadoHospitales atenciones={Array.isArray(pendientesFiltrados) ? pendientesFiltrados : []} />
          </>
        )}
      </div>
    );
  }

  // 📋 Vista principal de registros
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

      {/* 📅 Selector de Período */}
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
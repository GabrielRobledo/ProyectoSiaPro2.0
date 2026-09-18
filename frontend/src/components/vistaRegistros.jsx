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
    fetch( `${API_URL}/api/efectores`)
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

  // 🔍 Filtro por hospital
  const datosFiltrados = useMemo(() => {
    if (hospitalFiltro) {
      return datos.filter(d =>
        d.idEfector &&
        String(d.idEfector).toLowerCase() === String(hospitalFiltro).toLowerCase()
      );
    }
    return datos;
  }, [datos, hospitalFiltro]);


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
      <div>
        <h2>Hospitales pendientes de auditar</h2>
        {/* 🛠️ CORRECCIÓN: Usamos estrictamente 'pendientes'. Si el array está vacío, se mostrará vacío y no recurrirá a datos generales */}
        <ListadoHospitales atenciones={Array.isArray(pendientes) ? pendientes : []} />
      </div>
    );
  }

  // 📋 Vista principal de registros (listado o edición)
  return (
    <div>
      
      <h2>
        {editarAuditoria
          ? 'Editar Auditoría'
          : tipo
            ? `Listado de ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`
            : 'Listado'
        }
        {hospitalFiltro && nombreHospital && ` - Hospital: ${nombreHospital}`}
      </h2>


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
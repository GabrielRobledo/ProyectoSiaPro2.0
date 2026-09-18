
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import { useUser } from './contextUsers';
import '../styles/cardsHosp.css';

const ListadoHospitales = ({ atenciones }) => {
  const navigate = useNavigate();
  const { user } = useUser();

  // Agrupa atenciones por idEfector y cuenta por tipoAtencion
  const { resumen, tiposAtencionUnicos } = useMemo(() => {
    const resumen = {};
    const tiposSet = new Set();

    atenciones.forEach(({ RazonSocial, tipoAtencion, idEfector, reasignado }) => {
      if (!idEfector) return;
      tiposSet.add(tipoAtencion);

      if (!resumen[idEfector]) {
        resumen[idEfector] = { RazonSocial, conteos: {}, reasignado: Boolean(reasignado) };
      }

      if (!resumen[idEfector].conteos[tipoAtencion]) {
        resumen[idEfector].conteos[tipoAtencion] = 0;
      }

      resumen[idEfector].conteos[tipoAtencion]++;
    });

    return {
      resumen,
      tiposAtencionUnicos: Array.from(tiposSet),
    };
  }, [atenciones]);


  const esAuditor = user?.rol?.toLowerCase().trim() === 'auditor';
  const handleClickHospital = (idEfector) => {
    if (esAuditor) {
      navigate(`/registros/atenciones?hospital=${encodeURIComponent(idEfector)}`);
    }
  };

  return (
    <div className="cards-grid">
      {Object.entries(resumen).map(([idEfector, { RazonSocial, conteos, reasignado }]) => (
        <div
          key={idEfector}
          className={`card ${reasignado ? 'card-reasignado' : ''}`}
          onClick={() => handleClickHospital(idEfector)}
          style={{ cursor: esAuditor ? 'pointer' : 'not-allowed', opacity: esAuditor ? 1 : 0.7, borderLeft: reasignado ? '5px solid #ff9800' : 'none' }}
        >
          {reasignado && (
            <span className="badge-reasignado" style={{
              backgroundColor: '#ff9800',
              color: '#fff',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              position: 'absolute',
              top: '10px',
              right: '10px',
              fontWeight: 'bold'
            }}>
              Reasignado
            </span>
          )}
          <div className="card-header">
            <div className="card-icon">
              <LocalHospitalIcon />
            </div>
            <h3 className="card-title">{RazonSocial || 'Desconocido'}</h3>
          </div>
          <ul className="card-list">
            {tiposAtencionUnicos.map((tipo) => (
              <li key={tipo}>
                <strong>{tipo}:</strong> {conteos[tipo] || 0}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default ListadoHospitales;

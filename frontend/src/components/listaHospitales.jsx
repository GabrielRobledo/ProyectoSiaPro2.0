
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

    atenciones.forEach(({ RazonSocial, tipoAtencion, idEfector }) => {
      if (!idEfector) return;
      tiposSet.add(tipoAtencion);

      if (!resumen[idEfector]) {
        resumen[idEfector] = { RazonSocial, conteos: {} };
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
      {Object.entries(resumen).map(([idEfector, { RazonSocial, conteos }]) => (
        <div
          key={idEfector}
          className="card"
          onClick={() => handleClickHospital(idEfector)}
          style={{ cursor: esAuditor ? 'pointer' : 'not-allowed', opacity: esAuditor ? 1 : 0.7 }}
        >
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

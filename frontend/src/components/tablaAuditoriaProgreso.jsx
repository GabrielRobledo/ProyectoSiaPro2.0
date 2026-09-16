import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import API_URL from '../config';

const thStyle = {
  backgroundColor: '#0288d1',
  color: 'white',
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 'bold',
  borderBottom: '2px solid #e0e0e0',
};

const tdStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid #e0e0e0',
  verticalAlign: 'middle',
};

const inputStyle = {
  marginTop: '4px',
  padding: '6px',
  width: '100%',
  borderRadius: '5px',
  border: '1px solid #ccc',
  fontSize: '13px',
};

const selectStyle = {
  ...inputStyle,
};

const TablaBorradoresMui = () => {
  const [datos, setDatos] = useState([]);
  const [motivos, setMotivos] = useState({});
  const [filters, setFilters] = useState({});
  const { idEfector } = useParams(); 
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 30;
  const [idSerial, setIdSerial] = useState(null);
  const navigate = useNavigate();
  const [checkedRows, setCheckedRows] = useState({});
  
  const [visibleColumns, setVisibleColumns] = useState({
    idAtencion: true,
    tipoAtencion: true,
    fecha: true,
    apeYnom: true,
    codPractica: true,
    fechaPractica: true,
    cantidad: true,
    valorTotal: true,
    descripcion: true,
    debito: true,
    motivo: true,
    debitoCalculado: true,
    revisado: true,
  });

  useEffect(() => {
    
    const fetchData = async () => {
      const borradorRes = await fetch(`${API_URL}/api/borradores/efector/${idEfector}`);
      const motivosRes = await fetch(`${API_URL}/api/motivos`);

      const borrador = await borradorRes.json();
      const motivosData = await motivosRes.json();
      setIdSerial(borrador.id); 

      setDatos(
        Array.isArray(borrador.datos) ?
          borrador.datos.map(item => ({
            ...item,
            // Si trae motivo_id en la DB, lo precargamos
            motivo_id: item.motivo_id ?? null,
          })) : []
      );

      const motivosObj = {};
      motivosData.forEach(m => {
        motivosObj[m.motivo_id] = m.motivo;
      });
      setMotivos(motivosData);
    };
    fetchData();
  }, [idEfector]);

  

   const filteredData = datos.filter(item => {
    return Object.entries(filters).every(([col, val]) => {
      if (!val) return true;
      return String(item[col] ?? '').toLowerCase().includes(val.toLowerCase());
    });
  });
  

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const formatearMoneda = (valor) => {
    const numero = parseFloat(valor) || 0;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numero);
  };

  const handleRevisadoChange = (index) => {
    setDatos(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, revisado: !item.revisado } : item
      )
    );
  };

  const handleSelectAllChange = (e) => {
      const isChecked = e.target.checked;
      
      // Obtenemos los IDs o filtramos los índices de los elementos actualmente visibles/filtrados
      setDatos(prev =>
        prev.map(item => {
          // Comprobamos si el item actual está dentro de los filtrados actuales
          const estaFiltrado = filteredData.some(f => f.idAtencion === item.idAtencion);
          if (estaFiltrado) {
            return { ...item, revisado: isChecked };
          }
          return item;
        })
      );
    };

  const handleMotivoChange = (index, value) => {
    setDatos(prev =>
      prev.map((item, i) =>
        i === index
          ? { ...item, motivo_id: value !== '' ? parseInt(value) : null }
          : item
      )
    );
  };

  const handleEnviarRegistros = () => {
    const todosRevisados = datos.every(d => d.revisado);
    if (!todosRevisados) {
      return Swal.fire({
        icon: 'warning',
        title: 'Faltan registros por revisar',
        text: 'Debés marcar todos los registros antes de enviarlos.',
        confirmButtonText: 'Entendido',
      });
    }

    const registrosProcesados = datos.map(item => {
      const debito = parseFloat(item.debito) || 0;
      return {
        ...item,
        debito: debito.toFixed(2),
        motivo_id: debito > 0 ? item.motivo_id : null,
      };
    });

    const periodo = registrosProcesados[0]?.periodo || new Date().toISOString().slice(0,7);
    const idUsuario = 2;
    const idEfector = registrosProcesados[0]?.idEfector || 0;
    const totalDebitoFinal = registrosProcesados.reduce((acc, r) => acc + parseFloat(r.debito), 0);

    const payload = {
      periodo,
      idUsuario,
      idEfector,
      totalDebito: totalDebitoFinal,
      detalles: registrosProcesados.map(r => ({
        idAtencion: r.idAtencion,
        debito: parseFloat(r.debito),
        idMotivo: r.motivo_id ? Number(r.motivo_id) : null
      }))
    };

    fetch(`${API_URL}/api/auditorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(res => res.json())
    .then(() => {
      if (idSerial) {
        return fetch(`${API_URL}/api/borradores/${idSerial}`, {
          method: 'DELETE',
        })
        .then(delRes => {
          if (!delRes.ok) throw new Error('El servidor rechazó el borrado');
          return Swal.fire({
            icon: 'success',
            title: 'Auditoría cerrada y borrador eliminado correctamente',
            confirmButtonText: 'Aceptar',
          });
        });
      } else {
        return Swal.fire({
          icon: 'success',
          title: 'Auditoría cerrada correctamente',
          confirmButtonText: 'Aceptar',
        });
      }
    })
    .then(() => {
      navigate('/auditoriasParciales');
      setDatos([]);
    })
    .catch(err => {
      Swal.fire({
        icon: 'error',
        title: 'Error durante el proceso',
        text: err.message || 'Algo salió mal',
      });
    });
  };

const handleGuardarProgreso = async () => {
  const periodo = datos[0]?.periodo || new Date().toISOString().slice(0, 7);

  try {
    const response = await fetch(`${API_URL}/api/auditorias-en-progreso/actualizar/${idSerial}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        datos, // solo se actualiza esta columna + fechaguardado
      }),
    });

    if (!response.ok) {
      throw new Error('No se pudo guardar el progreso');
    }

    await Swal.fire({
      icon: 'success',
      title: 'Progreso guardado',
      text: 'Tu progreso fue guardado exitosamente.',
      timer: 1500,
      showConfirmButton: false,
    });

    navigate('/auditoriasParciales'); // ✅ Redirige tras el guardado
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: 'error',
      title: 'Error al guardar',
      text: err.message || 'No se pudo guardar el progreso.',
    });
  }
};


  const exportToExcel = () => {
    const headers = Object.keys(visibleColumns).filter(col => visibleColumns[col]);

    const rows = filteredData.map(item => {
      const row = {};
      headers.forEach(header => {
        row[header] = item[header] ?? '';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Borradores');

    XLSX.writeFile(workbook, 'borradores.xlsx');
  };



  const handleDebitoChange = (index, value) => {
    const newValue = parseFloat(value);
    if (isNaN(newValue)) return;

    setDatos(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const valorTotal = parseFloat(item.valorTotal) || 0;
        return {
          ...item,
          debito: (valorTotal * newValue).toFixed(1),
          // No tocar motivo_id aquí
        };
      })
    );
  };


  const handleFilterChange = (col, value) => {
    setFilters(prev => ({
      ...prev,
      [col]: value,
    }));
  };

  return (
  <div style={{
    overflowX: 'auto',
    backgroundColor: '#fff',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '10px',
    marginTop: '15px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
  }}>
    <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '10px' 
      }}>
        <button onClick={handleEnviarRegistros}
          style={{
              padding: '8px 14px',
              backgroundColor: '#007bff',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              marginRight: '10px',
              fontWeight: 'bold',
            }}
        >
          Cerrar Auditoría
        </button>
                <button onClick={handleGuardarProgreso}
          style={{
            padding: '8px 14px',
            backgroundColor: '#ffa000',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            marginRight: '10px',
            fontWeight: 'bold',
          }}
        >
          Guardar Progreso
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={exportToExcel} 
            style={{
                padding: '8px 14px',
                backgroundColor: '#009688',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
            Exportar a Excel
          </button>
          <button onClick={() => setFilters({})}>
            Limpiar filtros
          </button>
        </div>
      </div>
    {/* Mostrar columnas */}
    <div style={{ marginBottom: '10px' }}>
      <strong>Mostrar columnas:</strong>
      {Object.entries(visibleColumns).map(([colKey, isVisible]) => (
        <label key={colKey} style={{ marginLeft: '12px', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={isVisible}
            onChange={() =>
              setVisibleColumns(prev => ({
                ...prev,
                [colKey]: !prev[colKey],
              }))
            }
          />
          {' '}{colKey}
        </label>
      ))}
    </div>

    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        {/* Totales de Débito y Revisados */}
        <tr>
          {Object.entries(visibleColumns).map(([key, visible]) => {
            if (!visible) return null;

            if (key === 'debitoCalculado') {
              const totalDebito = filteredData.reduce(
                (acc, item) => acc + (parseFloat(item.debito) || 0),
                0
              );
              return (
                <th key={key} style={{ ...thStyle, backgroundColor: '#b3e5fc' }}>
                  <span style={{ color: '#00796b', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    Total: {formatearMoneda(totalDebito)}
                  </span>
                </th>
              );
            }

            if (key === 'revisado') {
              const totalRevisados = filteredData.filter(item => item.revisado).length;
              // Evaluamos si todos los de la vista filtrada actual tienen revisado = true
              const todosTildados = filteredData.length > 0 && filteredData.every(item => item.revisado);

              return (
                <th key={key} style={{ ...thStyle, backgroundColor: '#b3e5fc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={todosTildados}
                      onChange={handleSelectAllChange}
                      title="Marcar / Desmarcar todos"
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <span style={{ color: '#00796b', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      {totalRevisados} / {filteredData.length}
                    </span>
                  </div>
                </th>
              );
            }

            return <th key={key} style={{ ...thStyle, backgroundColor: '#b3e5fc' }}></th>;
          })}
        </tr>

        {/* Encabezados normales */}
          <tr>
            {Object.entries(visibleColumns).map(([key, visible]) =>
              visible ? (
                <th key={key} style={{ ...thStyle, verticalAlign: 'bottom' }}>
                  <div>{key}</div>
                  <input
                    type="text"
                    style={{ ...inputStyle, marginTop: '4px' }}
                    placeholder={`Filtrar `}
                    value={filters[key] || ''}
                    onChange={(e) => handleFilterChange(key, e.target.value)}
                  />
                </th>
              ) : null
            )}
          </tr>
      </thead>

      <tbody>
        {paginatedData.map((item, index) => {
          const globalIndex = startIndex + index;
          const valorTotal = parseFloat(item.valorTotal) || 0;
          const debito = parseFloat(item.debito) || 0;
          const debitoPercent = valorTotal ? debito / valorTotal : 0;

          return (
            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : '#ffffff' }}>
              {visibleColumns.idAtencion && <td style={tdStyle}>{item.idAtencion}</td>}
              {visibleColumns.tipoAtencion && <td style={tdStyle}>{item.tipoAtencion || '-'}</td>}
              {visibleColumns.fecha && <td style={tdStyle}>{item.fecha || '-'}</td>}
              {visibleColumns.apeYnom && <td style={tdStyle}>{item.apeYnom || '-'}</td>}
              {visibleColumns.codPractica && <td style={tdStyle}>{item.codPractica || '-'}</td>}
              {visibleColumns.fechaPractica && <td style={tdStyle}>{item.fechaPractica || '-'}</td>}
              {visibleColumns.cantidad && <td style={tdStyle}>{item.cantidad || '-'}</td>}
              {visibleColumns.valorTotal && <td style={tdStyle}>{formatearMoneda(valorTotal)}</td>}
              {visibleColumns.descripcion && <td style={tdStyle}>{item.descripcion || '-'}</td>}
              {visibleColumns.motivo_id && <td style={tdStyle}>{item.motivo_id || ''}</td>}
              {visibleColumns.debito && (
                <td style={tdStyle}>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.25"
                    value={debitoPercent.toFixed(2)|| ""}
                    style={inputStyle}
                    onChange={(e) => handleDebitoChange(globalIndex, e.target.value)}
                  />
                </td>
              )}
              {visibleColumns.motivo && (
                <td style={tdStyle}>
                  <select
                    value={item.motivo_id ?? ''} // importante usar motivo_id como value
                    onChange={(e) => handleMotivoChange(globalIndex, e.target.value)}
                    style={selectStyle}
                    disabled={debito === 0}
                  >
                    <option value="">-- Seleccione --</option>
                    {motivos.map((m) => (
                      <option key={m.idMotivo} value={m.idMotivo}>
                        {m.motivo}
                      </option>
                    ))}
                  </select>
                </td>
              )}
              {visibleColumns.debitoCalculado && (
                <td style={tdStyle}>{formatearMoneda(debito)}</td>
              )}
              {visibleColumns.revisado && (
                <td style={tdStyle}>
                  <input
                    type="checkbox"
                    checked={!!item.revisado}
                    onChange={() => handleRevisadoChange(globalIndex)}
                  />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>

    <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
      <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
        Anterior
      </button>
      <span>Página {currentPage} de {Math.ceil(filteredData.length / rowsPerPage)}</span>
      <button
        onClick={() =>
          setCurrentPage(prev =>
            prev < Math.ceil(filteredData.length / rowsPerPage) ? prev + 1 : prev
          )
        }
        disabled={currentPage === Math.ceil(filteredData.length / rowsPerPage)}
      >
        Siguiente
      </button>
    </div>
  </div>
);
};

export default TablaBorradoresMui;

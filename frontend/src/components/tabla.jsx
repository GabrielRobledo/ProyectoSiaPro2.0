import { useEffect, useMemo, useState } from "react";
import { useUser } from './contextUsers';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import API_URL from "../config";


const TablaConFiltro = ({ datos, tipo, setDatos, editarAuditoriaId }) => {
  const { user } = useUser();
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [inputValues, setInputValues] = useState({});
  const [motivosValues, setMotivosValues] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({});
  const [checkedRows, setCheckedRows] = useState({});
  const [motivos, setMotivos] = useState([]);
  // ...sin efectoresAsignados...
  const pageSize = 30;
  const navigate = useNavigate();
  const [hayCambios, setHayCambios] = useState(false);
  // ...sin useEffect de efectoresAsignados...

  
  useEffect(() => {
    // Obtener los motivos desde el backend
    fetch(`${API_URL}/api/motivos`)
      .then((res) => res.json())
      .then((data) => {
        setMotivos(data);
        console.log("Motivos obtenidos:", data);
      })
      .catch((err) => console.error("Error fetching motivos:", err));
  }, []);

  useEffect(() => {
    const nuevosValores = {};
    const nuevosChecks = {};

    datos.forEach((row) => {
      const debito = parseFloat(row.debito);
      const valorTotal = parseFloat(row.valorTotal);
      const rowKey = row.idAtencion; // Usá una key única

      if (!isNaN(debito) && valorTotal > 0) {
        nuevosValores[rowKey] = parseFloat((debito / valorTotal).toFixed(2));
        nuevosChecks[rowKey] = true;
      } else {
        nuevosValores[rowKey] = 0;
        nuevosChecks[rowKey] = false;
      }
    });

    setInputValues(nuevosValores);
    setCheckedRows(nuevosChecks);
  }, [datos]);

  useEffect(() => {
    if (!editarAuditoriaId || !Array.isArray(datos)) return;

    const motivosMap = {};

    datos.forEach((row) => {
      const rowKey = row.idAtencion;

      if (row.idMotivo) {
        motivosMap[rowKey] = { motivo: row.idMotivo };
      }
    });

    console.log("Motivos map:", motivosMap); // Verifica el contenido del mapa de motivos

    setMotivosValues(motivosMap);
  }, [editarAuditoriaId, datos]);
  
  useEffect(() => {
    const cambios = datos.some(item => {
      const valorTotal = parseFloat(item.valorTotal) || 0;
      const debito = parseFloat(item.debito) || 0;
      const debitoPercent = valorTotal ? debito / valorTotal : 0;
      const tieneMotivo = item.motivo_id !== null && item.motivo_id !== undefined;
      const revisado = !!item.revisado;

      return debitoPercent > 0 || tieneMotivo || revisado;
    });

    setHayCambios(cambios);
  }, [datos]);


  const handleInputChange = (rowId, value) => {
    setInputValues((prev) => ({ ...prev, [rowId]: value }));
  };

  const handleCheckboxChange = (rowId, isChecked) => {
    setCheckedRows((prev) => ({ ...prev, [rowId]: isChecked }));
  };

  const handleSelectAllChange = (e) => {
    const isChecked = e.target.checked;
    const nuevosChecks = { ...checkedRows };

    // Iteramos solo sobre las filas filtradas actuales (las visibles en la paginación o en general)
    filteredRows.forEach((row) => {
      const rowKey = row.original.idAtencion;
      nuevosChecks[rowKey] = isChecked;
    });

    setCheckedRows(nuevosChecks);
  };

  const formatearMoneda = (valor) => {
    const numero = parseFloat(valor) || 0;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numero);
  };

  const handleMotivoChange = (rowKey, motivoId) => {
    console.log('Motivo seleccionado:', motivoId); // Aquí se recibe el ID del motivo
    setMotivosValues((prev) => ({
      ...prev,
      [rowKey]: { motivo: motivoId }, // Guarda el ID, no el nombre
    }));
  };

  

  const columns = useMemo(() => {
  if (!datos || datos.length === 0) return [];

    const dataColumns = Object.keys(datos[0])
      .map((key) => ({
        accessorKey: key,
        header: key,
        cell: (info) => info.getValue(),
        filterFn: "includesString",
        enableSorting: true,
      }));  

  if (tipo === "atenciones") {
    const camposOcultos = ['idEfector', 'RazonSocial', 'debito','periodo', 'hospital'];

    const dataColumns = Object.keys(datos[0])
      .filter((key) => !camposOcultos.includes(key))
      .map((key) => ({
        accessorKey: key,
        header: key,
        // Si la columna es valorTotal, formateamos el número como moneda
        cell: (info) => {
          if (key === 'valorTotal') {
            return formatearMoneda(info.getValue());
          }
          return info.getValue();
        },
        filterFn: "includesString",
        enableSorting: true,
      }));
    if (editarAuditoriaId) {
      // En modo edición, mostramos inputs para editar valorNumerico y checkbox para revisar
      return [
        ...dataColumns,
        {
          accessorKey: "__valor",
          header: "Debito (%)",
          cell: ({ row }) => (
            <input
              type="number"
              step="0.25"
              min="0"
              max="1"

              value={inputValues[row.original.idAtencion] || ""}
              onChange={(e) => handleInputChange(row.original.idAtencion, e.target.value)}
              style={{ width: "80px", padding: "6px", borderRadius: "5px", border: "1px solid #ccc" }}
            />
          ),
          enableSorting: false,
        },

        {
          accessorKey: "__motivo",
          header: "Motivo",
          cell: ({ row }) => {
            const rowKey = row.original.idAtencion;
            return (
              <select
                value={motivosValues[rowKey]?.motivo || ""}
                onChange={(e) => handleMotivoChange(rowKey, Number(e.target.value))}
                disabled={parseFloat(inputValues[rowKey]) <= 0 || isNaN(parseFloat(inputValues[rowKey]))}
                style={{ padding: '6px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: parseFloat(inputValues[rowKey]) > 0 ? 'white' : '#f0f0f0' }}
              >
                <option value="">Seleccionar motivo</option>
                {motivos.map((motivo) => (
                  <option key={motivo.idMotivo} value={motivo.idMotivo}>
                    {motivo.motivo}
                  </option>
                ))}
              </select>
            );
          },
          enableSorting: false,
        },
        {
          accessorKey: "__debito",
          header: "Débito $",
          cell: ({ row }) => {
            const rowKey = row.original.idAtencion;
            const valorNumerico = parseFloat(inputValues[rowKey]) || 0;
            const importe = parseFloat(row.original.valorTotal) || 0;
            const debito = importe * valorNumerico;
            return formatearMoneda(debito); // <--- Formateado aquí
          },
          enableSorting: false,
        },
        {
          accessorKey: "__revisado",
          header: () => {
            // Verificamos si todos los filtrados actuales están tildados
            const todosVisiblesTildados = filteredRows.length > 0 && filteredRows.every((row) => checkedRows[row.original.idAtencion]);
            
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={todosVisiblesTildados}
                  onChange={handleSelectAllChange}
                  title="Marcar / Desmarcar todos los visibles"
                />
                <span>Revisado</span>
              </div>
            );
          },
          cell: ({ row }) => {
            const rowKey = row.original.idAtencion;
            return (
              <input
                type="checkbox"
                checked={!!checkedRows[rowKey]}
                onChange={(e) => handleCheckboxChange(rowKey, e.target.checked)}
              />
            );
          },
          enableSorting: false,
        },

      ];
    } else {
      // En modo solo lectura: mostramos solo el cálculo de Débito $ sin inputs
      return [
        ...dataColumns,
        {
          accessorKey: "__valor",
          header: "Debito (%)",
          cell: ({ row }) => {
            const rowKey = row.original.idAtencion;
            return (
              <input
                type="number"
                step="0.25"
                min="0"
                max="1"

                value={inputValues[rowKey] || ""}
                onChange={(e) => handleInputChange(rowKey, e.target.value)}
                style={{ width: "80px", padding: "6px", borderRadius: "5px", border: "1px solid #ccc" }}
              />
            );
          },
          enableSorting: false,
        },

        {
          accessorKey: "__motivo",
          header: "Motivo",
          cell: ({ row }) => {
            const rowKey = row.original.idAtencion;
            return (
             <select
                value={motivosValues[rowKey]?.motivo || ""}
                onChange={(e) => handleMotivoChange(rowKey, Number(e.target.value))}
                disabled={parseFloat(inputValues[rowKey]) <= 0 || isNaN(parseFloat(inputValues[rowKey]))}
                style={{ padding: '6px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: parseFloat(inputValues[rowKey]) > 0 ? 'white' : '#f0f0f0' }}
              >
              <option value="">Seleccionar motivo</option>
              {motivos.map((motivo) => (
                <option key={motivo.idMotivo} value={motivo.idMotivo}>
                  {motivo.motivo}
                </option>
              ))}
            </select>
            );
          },
          enableSorting: false,
        },  
        {
          accessorKey: "__debito",
          header: "Débito $",
          cell: ({ row }) => {
            const rowKey = row.original.idAtencion;
            const valorNumerico = parseFloat(inputValues[rowKey]) || 0;
            const importe = parseFloat(row.original.valorTotal) || 0;
            const debito = importe * valorNumerico;
            return formatearMoneda(debito); // <--- Formateado aquí
          },
          enableSorting: false,
        },
        {
          accessorKey: "__revisado",
          header: () => {
            // Verificamos si todos los filtrados actuales están tildados
            const todosVisiblesTildados = filteredRows.length > 0 && filteredRows.every((row) => checkedRows[row.original.idAtencion]);
            
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={todosVisiblesTildados}
                  onChange={handleSelectAllChange}
                  title="Marcar / Desmarcar todos los visibles"
                />
                <span>Revisado</span>
              </div>
            );
          },
          cell: ({ row }) => {
            const rowKey = row.original.idAtencion;
            return (
              <input
                type="checkbox"
                checked={!!checkedRows[rowKey]}
                onChange={(e) => handleCheckboxChange(rowKey, e.target.checked)}
              />
            );
          },
          enableSorting: false,
        },

      ];
    }
  }

  return dataColumns;
}, [datos, inputValues, motivosValues, tipo, checkedRows, editarAuditoriaId]);




  // Usar los datos originales sin filtrar por efectores asignados
  const datosFiltrados = datos;

  const table = useReactTable({
    data: Array.isArray(datos) ? datos : [],
    columns,
    state: {
      columnFilters,
      columnVisibility,
      sorting,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const filteredRows = table.getSortedRowModel().rows;

  const paginatedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageIndex, pageSize]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  
  useEffect(() => {
    const cambios = filteredRows.some((row) => {
      const rowKey = row.original.idAtencion;
      const valorNumerico = parseFloat(inputValues[rowKey]) || 0;
      const revisado = !!checkedRows[rowKey];
      const motivo_id = motivosValues[rowKey]?.motivo;

      return valorNumerico > 0 || revisado || motivo_id !== undefined;
    });

    setHayCambios(cambios);
  }, [inputValues, checkedRows, motivosValues, filteredRows]);


  useEffect(() => {
    setPageIndex(0);
  }, [columnFilters]);

  useEffect(() => {
    const idUsuario = user?.idUsuario;
    const idEfector = datos[0]?.idEfector;
    const periodo = datos[0]?.periodo;

    if (!editarAuditoriaId && idUsuario && idEfector && periodo) {
      fetch(`${API_URL}/api/auditorias-en-progreso/${idUsuario}/${idEfector}/${periodo}`)
        .then((res) => {
          if (res.status === 404) {
            console.log('No hay borrador guardado');
            return null;
          }
          return res.json();
        })
        .then((draft) => {
          if (draft && Array.isArray(draft)) {
            console.log('Cargando borrador desde el backend...');
            setDatos(draft);
          }
        })
        .catch((err) => {
          console.error('Error al recuperar borrador:', err);
        });
    }
  }, [editarAuditoriaId, datos, user]);


  const totalDebito = useMemo(() => {
    if (tipo !== "atenciones") return 0;
    return filteredRows.reduce((acc, row) => {
      const rowKey = row.original.idAtencion;
      const valorNumerico = parseFloat(inputValues[rowKey]) || 0;
      const importe = parseFloat(row.original.valorTotal) || 0;
      return acc + (importe * valorNumerico);
    }, 0);
  }, [filteredRows, inputValues, tipo]);

  const totalRevisados = useMemo(() => {
    return filteredRows.reduce((acc, row) => {
      const rowKey = row.original.idAtencion;
      return acc + (checkedRows[rowKey] ? 1 : 0);
    }, 0);
  }, [filteredRows, checkedRows]);

  const paginationButtonStyle = (disabled) => ({
    backgroundColor: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background-color 0.3s ease',
    fontWeight: 'bold'
  });


  const handleClearFilters = () => {
    // Resetear el estado de filtros global
    setColumnFilters([]);

    // Forzar limpieza de valores en columnas filtrables
    table.getAllLeafColumns().forEach((column) => {
      if (column.getCanFilter()) {
        column.setFilterValue(undefined); // O "" si usás texto simple
      }
    });

    // Reiniciar paginación
    setPageIndex(0);
  };

  const handleGuardarBorrador = async () => {
  const registros = filteredRows.map((row) => {
    const original = row.original;
    const rowKey = original.idAtencion;
    const debito = parseFloat(original.valorTotal) * parseFloat(inputValues[rowKey] || 0);
    const motivo_id = motivosValues[rowKey]?.motivo;

    return {
      ...original,
      debito: debito.toFixed(2),
      motivo_id,
      revisado: !!checkedRows[rowKey],
    };
  });

  const periodo = registros[0]?.periodo || new Date().toISOString().slice(0, 7);
  const idEfector = registros[0]?.idEfector || 0;
  const idUsuario = user?.idUsuario;

  try {
    // Verificamos si ya existe un progreso guardado
    const checkRes = await fetch(`${API_URL}/api/auditorias-en-progreso/${idUsuario}/${idEfector}/${periodo}`);
    
    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data && Array.isArray(data) && data.length > 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Ya existe un progreso guardado',
          text: 'No podés guardar un nuevo progreso para este efector y período.',
        });
        return;
      }
    }

    // Si no existe, guardamos normalmente
    const saveRes = await fetch(`${API_URL}/api/auditorias-en-progreso/${idUsuario}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idUsuario, idEfector, periodo, datos: registros }),
    });

    if (!saveRes.ok) {
      throw new Error('Error al guardar borrador');
    }

    Swal.fire({
      icon: 'success',
      title: 'Borrador guardado correctamente',
    }).then(() => {
      navigate('/auditoriasParciales'); 
    });
  } catch (err) {
    console.error('Error guardando borrador:', err);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: err.message || 'Algo salió mal',
    });
  }
};

  const handleEnviarRegistros = () => {
    const todosTildados = filteredRows.every((row) => checkedRows[row.original.idAtencion]);

    if (!todosTildados) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan registros por revisar',
        text: 'Debés marcar todos los registros antes de enviarlos.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const registrosProcesados = filteredRows.map((row) => {
      const original = row.original;
      const rowKey = original.idAtencion;

      // Aquí asegúrate de obtener el ID del motivo, no el nombre
      const motivo_id = motivosValues[rowKey]?.motivo; // Esto ahora es el ID, no el nombre

      const debito = parseFloat(original.valorTotal) * parseFloat(inputValues[rowKey]) || 0;

      return {
        ...original,
        debito: debito.toFixed(2),
        motivo_id,  // Ahora pasas el ID del motivo
      };
    });

    const periodo = registrosProcesados[0]?.periodo || new Date().toISOString().slice(0, 7);
    const idUsuario = user?.idUsuario;
    const idEfector = registrosProcesados[0]?.idEfector || 0;
    const totalDebitoFinal = registrosProcesados.reduce((acc, r) => acc + parseFloat(r.debito), 0);

    const payload = {
      periodo,
      idUsuario,
      idEfector,
      totalDebito: totalDebitoFinal,
      detalles: registrosProcesados.map((r) => ({
        idAtencion: r.idAtencion,
        debito: parseFloat(r.debito),
        idMotivo: r.motivo_id,  // Asegúrate de que estás pasando el ID del motivo aquí
      })),
    };

    const method = editarAuditoriaId ? 'PUT' : 'POST';
    const url = editarAuditoriaId
      ? `${API_URL}/api/auditorias/${editarAuditoriaId}`
      : `${API_URL}/api/auditorias`;

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: 'Auditoría guardada correctamente',
          confirmButtonText: 'Aceptar',
        }).then(() => {
          navigate('/dashboardAuditor');
        });

        if (!editarAuditoriaId) {
          const idsEnviados = new Set(registrosProcesados.map((r) => r.id));
          setDatos((prev) => prev.filter((r) => !idsEnviados.has(r.id)));
        } else {
          navigate('/auditorias');
        }
      })
      .catch((err) => {
        Swal.fire({
          icon: 'error',
          title: 'Error al enviar auditoría',
          text: err.message || 'Algo salió mal',
        });
      });
  };


  const exportarAExcel = () => {
    const registrosExportados = filteredRows.map((row) => {
      const rowData = { ...row.original };

      if (tipo === "atenciones") {
        const valorNumerico = parseFloat(inputValues[row.id]) || 0;
        const importe = parseFloat(row.original.valorTotal) || 0;
        const debito = importe * valorNumerico;
        rowData.ValorNumerico = valorNumerico;
        rowData.Debito = debito.toFixed(2);
        rowData.Revisado = !!checkedRows[row.id];
      }

      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(registrosExportados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    XLSX.writeFile(workbook, "auditoria.xlsx");
  };

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

  return (
    <div>
      {tipo === "atenciones" && (
        
    
      <div
        style={{
          marginBottom: "10px",
          fontWeight: "bold",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Lado izquierdo */}
        <div style={{ display: 'flex', gap: '10px' }}> 
          <button
            onClick={handleEnviarRegistros}
            style={{
              padding: '8px 14px',
              backgroundColor: '#007bff',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            {editarAuditoriaId ? "Actualizar Auditoría" : "Cerrar Auditoría"}
          </button>

          <button
            onClick={handleGuardarBorrador}
            disabled={!hayCambios}
            style={{
              padding: '8px 14px',
              backgroundColor: !hayCambios ? '#ccc' : '#ff9800',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: !hayCambios ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            Guardar Progreso
          </button>
        </div>

        {/* Lado derecho */}
        <div>
          <button
            onClick={exportarAExcel}
            style={{
              padding: '8px 14px',
              backgroundColor: '#009688',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              marginRight: '10px',
              fontWeight: 'bold',
            }}
          >
            Exportar a Excel
          </button>

          <button
            onClick={handleClearFilters}
            style={{
              padding: '8px 14px',
              backgroundColor: 'green',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
            }}
          >
            Borrar filtros
          </button>
        </div>
      </div>
    )}

      <div style={{ marginBottom: '10px' }}>
        <strong>Mostrar columnas:</strong>
        {table.getAllLeafColumns().map((column) => (
          <label key={column.id} style={{ marginLeft: '10px' }}>
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
            />{" "}
            {column.columnDef.header}
          </label>
        ))}
      </div>


      <div style={{
        overflowX: 'auto',
        backgroundColor: '#fff',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '10px',
        marginTop: '15px'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
        }}>
          <thead>
            {tipo === 'atenciones' && (
              <tr>
              {table.getVisibleLeafColumns().map((col) => (
                <th key={col.id} style={{ ...thStyle, backgroundColor: '#b3e5fc' }}>
                  {col.id === 'debito' && (
                    <span style={{ color: '#00796b', fontWeight: 'bold', fontSize: '1.2rem' }}>
                      Total: {formatearMoneda(totalDebito)}
                    </span>
                  )}
                  {col.id === 'revisado' && (
                    <span style={{ color: '#00796b', fontWeight: 'bold', fontSize: '1.2rem' }}>
                      {totalRevisados} / {filteredRows.length}
                    </span>
                  )}
                </th>
              ))}
              </tr>
            )}
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ ...thStyle, cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' 🔼'}
                    {header.column.getIsSorted() === 'desc' && ' 🔽'}
                    <div>
                      {header.column.getCanFilter() && (
                        <input
                          type="text"
                          value={header.column.getFilterValue() ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => header.column.setFilterValue(e.target.value)}
                          placeholder="Filtrar..."
                          style={inputStyle}
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paginatedRows.map((row, idx) => (
              <tr
                key={row.id}
                style={{
                  backgroundColor: idx % 2 === 0 ? '#f9f9f9' : '#ffffff',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e3f2fd')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#f9f9f9' : '#ffffff')}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={tdStyle}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
          <div style={{ marginTop: "10px", textAlign: 'center' }}>
            <div style={{ 
              marginTop: "20px", 
              textAlign: 'center', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setPageIndex(p => Math.max(p - 1, 0))}
                disabled={pageIndex === 0}
                style={paginationButtonStyle(pageIndex === 0)}
              >
                &lt;
              </button>

              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                Página {pageIndex + 1} de {totalPages}
              </span>

              <button
                onClick={() => setPageIndex(p => Math.min(p + 1, totalPages - 1))}
                disabled={pageIndex >= totalPages - 1}
                style={paginationButtonStyle(pageIndex >= totalPages - 1)}
              >
                &gt;
              </button>

              <span style={{ fontSize: '14px', color: '#777' }}>
                Total de registros: {table.getFilteredRowModel().rows.length}
              </span>
            </div>

          </div>

      </div>
    </div>
  );
};

export default TablaConFiltro;

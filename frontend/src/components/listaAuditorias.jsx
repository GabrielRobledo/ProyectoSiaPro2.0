import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from './contextUsers';
import Swal from 'sweetalert2';
import { FiEdit, FiTrash2, FiSearch, FiFileText } from 'react-icons/fi';
import { Bar, Pie } from 'react-chartjs-2';
import { FiMaximize } from 'react-icons/fi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import API_URL from '../config';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function AuditoriasList() {
  const [auditorias, setAuditorias] = useState([]);
  const [tab, setTab] = useState('listado');
  const [motivosTotales, setMotivosTotales] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [ampliarGrafico, setAmpliarGrafico] = useState(null); 
  const { user } = useUser();

  // 🛡️ PROTECCIÓN AQUÍ: Si el usuario todavía es null, muestra un mensaje de carga
  if (!user) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando sesión...</div>;
  }

  useEffect(() => {
    fetch(`${API_URL}/api/motivosTotales`)
      .then(res => res.json())
      .then(data => setMotivosTotales(data))
      .catch(err => Swal.fire('Error', err.message, 'error'));
    fetch(`${API_URL}/api/listarCierres`)
      .then(res => res.json())
      .then(data => {
        setCierres(data);
        console.log('cierres:', data); // <- Agregá esto
      })
    .catch(err => Swal.fire('Error', err.message, 'error'));
    fetch(`${API_URL}/api/auditorias`)
    .then(res => res.json())
    .then(data => {
      // Filtrar por usuario logueado
      const { idUsuario } = user || {};
      const filtradas = idUsuario ? data.filter(a => String(a.idUsuario) === String(idUsuario)) : data;
      const sorted = filtradas.sort((a,b)=>b.idAuditoria - a.idAuditoria);
      setAuditorias(sorted);
      console.log('auditorias:', sorted); // <- Agregá esto
    })
  }, []);

  const auditoriaCerrada = (idEfector, periodo) => {
    return cierres.some(
      (cierre) =>
        String(cierre.idEfector) === String(idEfector) &&
        String(cierre.periodo) === String(periodo)
    );
  };


  const navigate = useNavigate();
  const eliminar = id => {
    Swal.fire({
      title: '¿Eliminar esta auditoría?',
      icon: 'warning',
      showCancelButton: true
    }).then(ok => {
      if (!ok.isConfirmed) return;
      fetch(`${API_URL}/api/auditorias/${id}`, { method: 'DELETE' })
        .then(res => {
          if (res.ok) {
            setAuditorias(prev => prev.filter(a => a.idAuditoria !== id));
            Swal.fire('Eliminada', 'Auditoría eliminada', 'success');
          }
        })
        .catch(err => Swal.fire('Error', err.message, 'error'));
    });
  };

  const columns = useMemo(() => [
    { accessorKey: 'idAuditoria', header: 'ID' },
    { accessorKey: 'Hospital', header: 'Hospital' },
    { accessorKey: 'periodo', header: 'Periodo' },
    {
      accessorKey: 'totalFacturado', 
      header: 'Total Facturado', 
      cell: info => `$${parseFloat(info.getValue()||0).toFixed(2)}`, 
    },
    {
      accessorKey: 'totalDebito',
      header: 'Total Débito',
      cell: info => `$${parseFloat(info.getValue()||0).toFixed(2)}`,
    },
    {
      accessorFn: r => parseFloat(r.totalFacturado||0) - parseFloat(r.totalDebito||0),
      id: 'totalNeto',
      header: 'Total Neto',
      cell: info => `$${parseFloat(info.getValue()||0).toFixed(2)}`,
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => {
        const auditoria = row.original;
        const estaCerrada = auditoriaCerrada(auditoria.idEfector, auditoria.periodo); // 👈 Evaluar aquí, no antes

        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={e => {
                if (estaCerrada) return;
                e.stopPropagation();
                navigate(`/auditorias/${auditoria.idAuditoria}`);
              }}
              style={{
                ...iconButtonStyle(estaCerrada ? '#aaa' : '#1976d2'),
                cursor: estaCerrada ? 'not-allowed' : 'pointer',
              }}
              title={estaCerrada ? 'Auditoría cerrada' : 'Editar auditoría'}
            >
              <FiEdit />
            </button>
            <button
              onClick={e => {
                if (estaCerrada) return;
                e.stopPropagation();
                eliminar(auditoria.idAuditoria);
              }}
              style={{
                ...iconButtonStyle(estaCerrada ? '#aaa' : '#d32f2f'),
                cursor: estaCerrada ? 'not-allowed' : 'pointer',
              }}
              title={estaCerrada ? 'Auditoría cerrada' : 'Eliminar auditoría'}
            >
              <FiTrash2 />
            </button>
          </div>
        );
      }
    },
    {
      id: 'estado',
      header: 'Estado',
      cell: ({ row }) => {
        const auditoria = row.original;
        const estaCerrada = auditoriaCerrada(auditoria.idEfector, auditoria.periodo);
        return estaCerrada ? (
          <span style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '15px',
            backgroundColor: '#4caf50',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            userSelect: 'none',
            textAlign: 'center',
            width: '70px',
          }}>
            Cerrado
          </span>
        ) : (
          <span style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '15px',
            backgroundColor: '#f44336',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            userSelect: 'none',
            textAlign: 'center',
            width: '80px',
          }}>
            Pendiente
          </span>
        );
      }
    }



  ], [navigate, cierres]);

  const [globalFilter, setGlobalFilter] = useState('');
  const table = useReactTable({
    data: auditorias,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString'
  });

 

  // Exportar Excel
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(auditorias);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditorias');
    const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    saveAs(new Blob([buf],{type:'application/octet-stream'}), 'auditorias.xlsx');
  };

  // Exportar PDF
  const exportPDF = () => {
   const doc = new jsPDF();
    autoTable(doc, {
      startY: 28,
      head: [table.getHeaderGroups()[0].headers.map(h => h.column.columnDef.header)],
      body: table.getRowModel().rows.map(r => r.getVisibleCells().map(c => typeof c.getValue()==='number' ? c.getValue().toFixed(2) : c.getValue())),
    });
    doc.text('Listado de Auditorías', 14, 22);
    doc.save('auditorias.pdf');
  };

  return (
    <div style={{padding:'2rem', position:'relative', minHeight:'100vh'}}>
      <h2>Auditorías finalizadas</h2>
      <div style={{display:'flex', gap:'1rem', alignItems:'center', marginBottom:'1rem'}}>
        <div style={{position:'relative', flex:'0 0 350px'}}>
          <FiSearch style={{position:'absolute', top:'50%', left:'10px', transform:'translateY(-50%)', color:'#1976d2'}}/>
          <input
            value={globalFilter ?? ''}
            onChange={e=>setGlobalFilter(e.target.value)}
            placeholder="🔍 Buscar auditorías..."
            style={{padding:'10px 40px', width:'100%', border:'2px solid #1976d2', borderRadius:'5px'}}
          />
        </div>
        <button onClick={exportExcel} style={excelBtnStyle}>📥 Excel</button>
        <button onClick={exportPDF} style={pdfBtnStyle}><FiFileText/> PDF</button>
      </div>

      {/* Tabs */}
      <div style={{display:'flex', borderBottom:'2px solid #ccc', marginBottom:'1rem'}}>
        <button onClick={()=>setTab('listado')} style={tabButtonStyle(tab==='listado')}>🗂 Listado de Auditorías</button>
        <button onClick={()=>setTab('graficos')} style={tabButtonStyle(tab==='graficos')}>📊 Visualización Gráfica</button>
      </div>

      {/* Listado filtrable/ordenable */}
      {tab==='listado' && (
        <div style={{overflowX:'auto', borderRadius:'10px', backgroundColor:'#fff'}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              {table.getHeaderGroups().map(hg=>(
                <tr key={hg.id}>
                  {hg.headers.map(h=>(
                    <th key={h.id} style={thStyle} onClick={h.column.getToggleSortingHandler()}>
                      {flexRender(h.column.columnDef.header,h.getContext())}
                      {h.column.getIsSorted()==='asc' ? ' 🔼' : h.column.getIsSorted()==='desc' ? ' 🔽' : ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row=>(
                <tr key={row.id}
                  style={{backgroundColor:'#fff',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.backgroundColor='#e3f2fd'}
                  onMouseLeave={e=>e.currentTarget.style.backgroundColor='#fff'}
                  onClick={()=>navigate(`/auditorias/${row.original.idAuditoria}/detalle`)}
                >
                  {row.getVisibleCells().map(cell=>(
                    <td key={cell.id} style={tdStyle}>
                      {flexRender(cell.column.columnDef.cell,cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginación */}
          <div style={paginationStyle}>
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              style={pageButtonStyle(!table.getCanPreviousPage())}
            >
              {'<<'}
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              style={pageButtonStyle(!table.getCanPreviousPage())}
            >
              {'<'}
            </button>
            <span style={{margin:'0 10px'}}>
              Página <strong>{table.getState().pagination.pageIndex + 1} de {table.getPageCount()}</strong>
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              style={pageButtonStyle(!table.getCanNextPage())}
            >
              {'>'}
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              style={pageButtonStyle(!table.getCanNextPage())}
            >
              {'>>'}
            </button>
          </div>

          <div style={{padding:'1rem', fontSize:'14px'}}>Registros mostrados: {table.getRowModel().rows.length}</div>
        </div>
      )}

      {/* Gráficos */}
      {tab==='graficos' && auditorias.length>0 && (
        <div>
          <h3>Visualización de Datos</h3>
          <div style={{display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'2rem', marginTop:'2rem'}}>
            <div style={{ position: 'relative', flex: '1 1 600px', maxWidth: '800px' }}>
              <button 
                onClick={() => setAmpliarGrafico('barra')} 
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(0,0,0,0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  padding: '4px',
                  zIndex: 10,
                }}
                title="Ampliar gráfico"
              >
                <FiMaximize size={20} />
              </button>
              <Bar
                data={{
                  labels: auditorias.map(a => a.Hospital),
                  datasets: [
                    { label: 'Total Débito', data: auditorias.map(a => a.totalDebito), backgroundColor: 'rgba(25,118,210,0.7)', borderColor: 'rgba(25,118,210,1)', borderWidth: 1 },
                    { label: 'Total Facturado', data: auditorias.map(a => a.totalFacturado), backgroundColor: 'rgba(76,175,80,0.7)', borderColor: 'rgba(76,175,80,1)', borderWidth: 1 },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Comparativa: Débito vs Facturación' },
                  },
                }}
                height={300}
              />
            </div>

            <div style={{ position: 'relative', flex: '1 1 500px', maxWidth: '600px' }}>
              <button 
                onClick={() => setAmpliarGrafico('pie')} 
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(0,0,0,0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  padding: '4px',
                  zIndex: 10,
                }}
                title="Ampliar gráfico"
              >
                <FiMaximize size={20} />
              </button>
              <Pie
                data={{
                  labels: motivosTotales.map(m => m.motivo),
                  datasets: [
                    { label: 'Cantidad de Auditorías', data: motivosTotales.map(m => m.cantidad), backgroundColor: motivosTotales.map(() => `hsl(${Math.random() * 360},70%,60%)`) }
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Distribución por Motivos' },
                  },
                }}
                height={250}
              />
            </div>

          </div>
        </div>
      )}

      <button onClick={()=>navigate('/dashboardAuditor')} style={{position:'absolute',bottom:'20px',left:'20px',padding:'10px 20px',backgroundColor:'#1976d2',color:'#fff',border:'none',borderRadius:'5px',cursor:'pointer'}}>← Volver al Dashboard</button>
      {ampliarGrafico && (
        <div
          onClick={() => setAmpliarGrafico(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.3s ease-in-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '10px',
              padding: '1.5rem',
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              width: ampliarGrafico === 'barra' ? '80vw' : '60vw',
              height: ampliarGrafico === 'barra' ? '65vh' : '55vh',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Botón cerrar */}
            <button
              onClick={() => setAmpliarGrafico(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: '#f44336',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
            >
              Cerrar ✖
            </button>

            {/* Título */}
            <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#1976d2' }}>
              {ampliarGrafico === 'barra' ? 'Gráfico de Débito vs Facturación' : 'Gráfico de Distribución por Motivos'}
            </h3>

            {/* Contenido del gráfico */}
            <div style={{ flex: 1 }}>
              {ampliarGrafico === 'barra' && (
                <Bar
                  data={{
                    labels: auditorias.map((a) => a.Hospital),
                    datasets: [
                      {
                        label: 'Total Débito',
                        data: auditorias.map((a) => a.totalDebito),
                        backgroundColor: 'rgba(25,118,210,0.7)',
                        borderColor: 'rgba(25,118,210,1)',
                        borderWidth: 1,
                      },
                      {
                        label: 'Total Facturado',
                        data: auditorias.map((a) => a.totalFacturado),
                        backgroundColor: 'rgba(76,175,80,0.7)',
                        borderColor: 'rgba(76,175,80,1)',
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: false },
                    },
                  }}
                />
              )}
              {ampliarGrafico === 'pie' && (
                <Pie
                  data={{
                    labels: motivosTotales.map((m) => m.motivo),
                    datasets: [
                      {
                        label: 'Cantidad de Auditorías',
                        data: motivosTotales.map((m) => m.cantidad),
                        backgroundColor: motivosTotales.map(
                          () => `hsl(${Math.random() * 360},70%,60%)`
                        ),
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom' },
                      title: { display: false },
                    },
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Estilos
const thStyle = {
  backgroundColor:'#1976d2',
  color:'#fff',
  textAlign:'left',
  padding:'12px 16px',
  cursor:'pointer',
  userSelect:'none'
};
const tdStyle = {
  padding:'12px 16px',
  borderBottom:'1px solid #e0e0e0'
};
const tabButtonStyle = active => ({
  padding:'0.5rem 1rem',
  border:'none',
  borderBottom: active ? '3px solid #1976d2' : 'none',
  background:'transparent',
  cursor:'pointer',
  fontWeight: active ? 'bold' : 'normal',
  color: active ? '#1976d2' : '#555',
  userSelect: 'none'
});
const iconButtonStyle = color => ({
  background:'none',
  border:'none',
  cursor:'pointer',
  color: color,
  fontSize:'1.2rem',
  marginRight:'10px'
});
const excelBtnStyle = {
  padding:'10px 16px',
  backgroundColor:'#4caf50',
  color:'#fff',
  border:'none',
  borderRadius:'5px',
  cursor:'pointer'
};
const pdfBtnStyle = {
  display:'flex',
  alignItems:'center',
  padding:'10px 16px',
  backgroundColor:'#d32f2f',
  color:'#fff',
  border:'none',
  borderRadius:'5px',
  cursor:'pointer',
  gap:'6px'
};
const paginationStyle = {
  marginTop: '10px',
  display: 'flex',
  justifyContent: 'center',
  gap: '8px',
  alignItems: 'center',
};
const pageButtonStyle = disabled => ({
  cursor: disabled ? 'not-allowed' : 'pointer',
  padding: '6px 12px',
  borderRadius: '5px',
  border: '1px solid #1976d2',
  backgroundColor: disabled ? '#ccc' : '#1976d2',
  color: disabled ? '#666' : '#fff',
  userSelect: 'none'
});

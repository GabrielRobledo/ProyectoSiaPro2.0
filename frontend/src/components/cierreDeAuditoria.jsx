import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  Select,
  Button,
  Spin,
  Alert,
  Typography,
  Divider,
  Card,
  Row,
  Col,
  Statistic,
  Table as AntTable,
  Space,
  Modal
} from 'antd';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { CheckCircleOutlined, WarningOutlined, DashboardOutlined } from '@ant-design/icons';
import API_URL from '../config';

const { Title, Text } = Typography;
const { Option } = Select;
const columnHelper = createColumnHelper();

const CierreDeAuditoria = ({ idUsuario }) => {
  const [efectores, setEfectores] = useState([]);
  const [auditorias, setAuditorias] = useState([]);
  const [todosLosPeriodos, setTodosLosPeriodos] = useState([]);
  const [cierres, setCierres] = useState([]);

  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [cierreSeleccionadoId, setCierreSeleccionadoId] = useState(null);
  const [detalleCierre, setDetalleCierre] = useState([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resEfectores, resAuditorias] = await Promise.all([
          axios.get(`${API_URL}/api/efectores`),
          axios.get(`${API_URL}/api/auditorias`),
        ]);
        setEfectores(resEfectores.data);
        setAuditorias(resAuditorias.data);

        const periodosUnicos = [...new Set(resAuditorias.data.map(a => a.periodo))];
        setTodosLosPeriodos(periodosUnicos);
      } catch (error) {
        console.error('Error al cargar datos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    cargarCierres();
  }, []);

  const cargarCierres = () => {
    axios
      .get(`${API_URL}/api/listarCierresGenerales`)
      .then((res) => setCierres(res.data))
      .catch((err) => console.error('Error al obtener cierres generales:', err));
  };

  // Efectores con auditoría en el periodo seleccionado y que aún NO tienen cierre
  const efectoresAuditadosPendientes = useMemo(() => {
    if (!periodoSeleccionado) return [];

    const auditoriasEnPeriodo = auditorias.filter(a => a.periodo === periodoSeleccionado);
    const idsEfectoresAuditados = [...new Set(auditoriasEnPeriodo.map(a => a.idEfector))];
    const idsEfectoresConCierre = cierres
      .filter(c => c.periodo === periodoSeleccionado)
      .map(c => c.idEfector);

    return efectores.filter(
      ef => idsEfectoresAuditados.includes(ef.idEfector) && !idsEfectoresConCierre.includes(ef.idEfector)
    );
  }, [periodoSeleccionado, auditorias, efectores, cierres]);

  // Efectores que NO tienen auditoría en el periodo seleccionado (No llegaron)
  const efectoresNoAuditados = useMemo(() => {
    if (!periodoSeleccionado) return [];

    const auditoriasEnPeriodo = auditorias.filter(a => a.periodo === periodoSeleccionado);
    const idsEfectoresAuditados = [...new Set(auditoriasEnPeriodo.map(a => a.idEfector))];

    return efectores.filter(ef => !idsEfectoresAuditados.includes(ef.idEfector));
  }, [periodoSeleccionado, auditorias, efectores]);

  const generarCierreGeneral = async () => {
    // Obtenemos el usuario directamente del localStorage de forma segura
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const usuarioIdReal = idUsuario || storedUser?.idUsuario || storedUser?.id;

    if (!periodoSeleccionado || efectoresAuditadosPendientes.length === 0 || !usuarioIdReal) {
      Swal.fire('❌ Error', 'Faltan datos o no se pudo identificar al usuario actual.', 'error');
      return;
    }

    const confirmacion = await Swal.fire({
      title: '¿Confirmar Cierre General?',
      text: `Se generará el cierre masivo para ${efectoresAuditadosPendientes.length} efectores auditados en el periodo ${periodoSeleccionado}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, generar cierre general',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await axios.post(`${API_URL}/api/cierres-masivos`, {
        periodo: periodoSeleccionado,
        efectoresIds: efectoresAuditadosPendientes.map(e => e.idEfector),
        idUsuario: Number(usuarioIdReal),
      });

      Swal.fire('✅ Cierre General Exitoso', 'Los cierres del periodo se generaron correctamente.', 'success');
      setPeriodoSeleccionado('');
      cargarCierres();
    } catch (error) {
      console.error(error);
      Swal.fire('❌ Error', error.response?.data?.error || 'Hubo un problema al procesar el cierre masivo.', 'error');
    }
  };

  // Columnas para la tabla con TanStack Table
  const columns = useMemo(
    () => [
      columnHelper.accessor('codPrestador', {
        header: 'Código',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('RazonSocial', {
        header: 'Hospital / Efector',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('estado', {
        header: 'Estado',
        cell: () => <span style={{ color: '#52c41a', fontWeight: '500' }}>Listo para Cierre</span>,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: efectoresAuditadosPendientes,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const verDetalleCierre = async (idCierre) => {
    setCierreSeleccionadoId(idCierre);
    setModalVisible(true);
    setLoadingDetalle(true);

    try {
      // Petición al endpoint que creamos en el backend
      const response = await axios.get(`${API_URL}/api/${idCierre}/detalle`);
      // O si tu backend devuelve directamente el array o dentro de una propiedad data:
      setDetalleCierre(response.data.data || response.data);
    } catch (error) {
      console.error('Error al obtener el detalle del cierre:', error);
      Swal.fire('❌ Error', 'No se pudo cargar el detalle del cierre.', 'error');
    } finally {
      setLoadingDetalle(false);
    }
  };
  return (
      <div style={{ maxWidth: 1100, margin: '40px auto', padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.05)' }}>
        
        <Space align="center" size="middle" style={{ marginBottom: 24 }}>
          <DashboardOutlined style={{ fontSize: '28px', color: '#1890ff' }} />
          <div>
            <Title level={3} style={{ margin: 0 }}>Cierre General de Auditoría por Periodo</Title>
            <Text type="secondary">Panel de control y consolidación de cierres hospitalarios mensuales.</Text>
          </div>
        </Space>

        <Divider />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : (
          <>
            {/* Selección de Periodo */}
            <div style={{ marginBottom: 24, maxWidth: '400px' }}>
              <label style={{ fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>Seleccionar Período a Cerrar:</label>
              <Select
                placeholder="Ej: 2026-09"
                value={periodoSeleccionado || undefined}
                onChange={(value) => setPeriodoSeleccionado(value)}
                style={{ width: '100%' }}
              >
                {todosLosPeriodos.map((p, index) => (
                  <Option key={index} value={p}>{p}</Option>
                ))}
              </Select>
            </div>

            {periodoSeleccionado && (
              <>
                {/* Resumen Estadístico de la Situación del Periodo */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={12}>
                    <Card style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
                      <Statistic 
                        title="Efectores Listos (Auditados)" 
                        value={efectoresAuditadosPendientes.length} 
                        valueStyle={{ color: '#3f8600' }}
                        prefix={<CheckCircleOutlined />} 
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card style={{ backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}>
                      <Statistic 
                        title="Efectores Sin Auditoría (No llegaron)" 
                        value={efectoresNoAuditados.length} 
                        valueStyle={{ color: '#faad14' }}
                        prefix={<WarningOutlined />} 
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Tabla de Efectores Listos para el Cierre */}
                <div style={{ marginBottom: 24 }}>
                  <Title level={4} style={{ color: '#333' }}>Efectores Auditados pendientes de Cierre</Title>
                  <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        {table.getHeaderGroups().map(headerGroup => (
                          <tr key={headerGroup.id} style={{ background: '#fafafa' }}>
                            {headerGroup.headers.map(header => (
                              <th key={header.id} style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {table.getRowModel().rows.length ? (
                          table.getRowModel().rows.map(row => (
                            <tr key={row.id}>
                              {row.getVisibleCells().map(cell => (
                                <td key={cell.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={columns.length} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                              No hay efectores pendientes de cierre para este período.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Listado resumido de los que NO llegaron */}
                {efectoresNoAuditados.length > 0 && (
                  <div style={{ marginBottom: 24, padding: '16px', background: '#fff9f6', borderRadius: '8px', border: '1px solid #ffd8c2' }}>
                    <Text strong style={{ color: '#d4380d' }}>Atención: Los siguientes efectores no registran auditorías finalizadas en este periodo y quedarán excluidos del cierre general:</Text>
                    <ul style={{ margin: '8px 0 0 20px', color: '#595959' }}>
                      {efectoresNoAuditados.map(ef => (
                        <li key={ef.idEfector}>{ef.RazonSocial} (Cod: {ef.codPrestador})</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Botón de Ejecución del Cierre General */}
                <Button
                  type="primary"
                  size="large"
                  block
                  disabled={efectoresAuditadosPendientes.length === 0}
                  onClick={generarCierreGeneral}
                  style={{ height: '50px', fontWeight: 'bold', fontSize: '16px', borderRadius: '8px' }}
                >
                  🚀 Ejecutar Cierre General del Periodo ({periodoSeleccionado})
                </Button>
              </>
            )}

            {/* ── HISTORIAL DE CIERRES GENERALES REALIZADOS ── */}
            <Divider style={{ margin: '40px 0 20px 0' }} />
            <Title level={4} style={{ color: '#333', marginBottom: 16 }}>Historial de Cierres Generales</Title>
            
            <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: '8px', background: '#fafafa' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>ID Cierre General</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Período</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fecha y Hora</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Total Atenciones</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Usuario</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cierres.length ? (
                    cierres.map(cierre => (
                      <tr key={cierre.idCierreGeneral} style={{ borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
                        <td style={{ padding: '12px 16px' }}>#{cierre.idCierreGeneral}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{cierre.periodo}</td>
                        <td style={{ padding: '12px 16px' }}>{new Date(cierre.fecha_cierre).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{cierre.total_atenciones}</td>
                        <td style={{ padding: '12px 16px' }}>{cierre.usuario}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <Button 
                            type="primary" 
                            ghost 
                            size="small"
                            onClick={() => verDetalleCierre(cierre.idCierreGeneral)}
                          >
                            Ver Hospitales / Detalle
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#999', background: '#fff' }}>
                        No se registran cierres generales previos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── MODAL DE DETALLE DEL CIERRE ── */}
            <Modal
              title={`Detalle Consolidado del Cierre General #${cierreSeleccionadoId || ''}`}
              open={modalVisible}
              onCancel={() => setModalVisible(false)}
              footer={[
                <Button key="back" type="primary" onClick={() => setModalVisible(false)}>
                  Cerrar
                </Button>
              ]}
              width={900}
            >
              {loadingDetalle ? (
                <div style={{ textAlign: 'center', padding: '40px' }}><Spin size="large" /></div>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Hospital / Efector</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Total Facturado</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Total Debitado</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Total Neto</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>¿Tiene Débito?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleCierre.length > 0 ? (
                        detalleCierre.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '10px', fontWeight: '500' }}>{item.hospital}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>${Number(item.total_facturado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '10px', textAlign: 'right', color: '#cf1322' }}>${Number(item.total_debitado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '10px', textAlign: 'right', color: '#3f8600', fontWeight: 'bold' }}>${Number(item.total_neto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {item.cantidad_debitos === 1 ? (
                                <span style={{ color: '#cf1322', fontWeight: 'bold' }}>Sí</span>
                              ) : (
                                <span style={{ color: '#52c41a' }}>No</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                            No hay datos detallados para este cierre.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Modal>

          </>
        )}
      </div>
    );
};

export default CierreDeAuditoria;
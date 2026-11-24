import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Button, Upload, Typography, message, Alert, Space, Divider, Row, Col, Statistic, Table, Modal, Tag } from 'antd';
import { 
    CloudUploadOutlined, 
    CheckCircleOutlined, 
    ExclamationCircleOutlined, 
    InfoCircleOutlined, 
    WarningOutlined,
    FileTextOutlined, 
    UserAddOutlined, 
    TeamOutlined, 
    MedicineBoxOutlined,
    DashboardOutlined,
    HistoryOutlined,
    TableOutlined
} from '@ant-design/icons';
import API_URL from '../config';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const COLUMNAS_HOJA1 = [
    'NRO_PRESTACION', 'tipoatencion', 'FECHA_DE_PRESTACION', 'NRO_BENEFICIO',
    'GRADO_PARENTESCO', 'APELLIDO_Y_NOMBRE', 'MODALIDAD_PRESTACION',
    'NRO_ORDEN_DE_PRESTACION', 'MATRICULA', 'MODULO', 'NOMBRE_MODULO',
    'PRACTICA', 'D_PRACTICA', 'F_PRACTICA', 'CANT.', 'D_PRESTACION',
    'MODALIDAD_PRESTACION.1', 'NRO_ORDEN_PRESTACION_PRACTICA',
    'BOCA_ATENCION', 'Valor Unitario', 'Valor Total', 'BA Externa',
    'Efector', 'CONVENIO', 'OBSERVACIONES', 'para banco de sangre y laboratorio',
    'cod', 'Cant. Débito', 'Debito'
];

const COLUMNAS_HOJA3 = [
    'modulo', 'codPractica', 'DescripcionPractica', 'Valor GENERAL'
];

const UpdatePeriodoFacturacion = () => {
    const [file, setFile] = useState(null);
    const [verificando, setVerificando] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });
    const [resumenData, setResumenData] = useState(null);
    const [historico, setHistorico] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    // Estado para el modal de aviso previo por hash duplicado
    const [duplicadoModalVisible, setDuplicadoModalVisible] = useState(false);
    const [infoDuplicado, setInfoDuplicado] = useState(null);

    // Estado para el modal de formato esperado del Excel
    const [formatoModalVisible, setFormatoModalVisible] = useState(false);

    useEffect(() => {
        cargarHistorico();
    }, []);

    const cargarHistorico = async () => {
        setLoadingHistorico(true);
        try {
            const response = await axios.get(`${API_URL}/api/periodos-historicos`);
            setHistorico(response.data);
        } catch (error) {
            console.error('Error al cargar el historial:', error);
        } finally {
            setLoadingHistorico(false);
        }
    };

    const limpiarSeleccion = () => {
        setFile(null);
        setInfoDuplicado(null);
        setDuplicadoModalVisible(false);
        setStatus({ type: '', msg: '' });
        setResumenData(null);
    };

    // 1. Chequeo rápido previo al seleccionar el archivo
    const verificarArchivoPrevio = async (fileSeleccionado) => {
        setVerificando(true);
        setStatus({ type: 'info', msg: 'Verificando si este archivo ya fue importado...' });

        try {
            const formData = new FormData();
            formData.append('archivo', fileSeleccionado);

            const response = await axios.post(`${API_URL}/api/verificar-archivo`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data?.alreadyImported) {
                setInfoDuplicado({
                    ...(response.data.registroPrevio || {}),
                    hashArchivo: response.data.hashArchivo,
                    mensaje: response.data.mensaje
                });
                setDuplicadoModalVisible(true);
                setStatus({
                    type: 'warning',
                    msg: 'Este archivo ya figura importado previamente. Confirme o cancele en el aviso.'
                });
            } else {
                setStatus({ type: '', msg: '' });
            }
        } catch (error) {
            console.error('Error al verificar archivo:', error);
            setStatus({ type: '', msg: '' });
        } finally {
            setVerificando(false);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            message.warning('Por favor, seleccione un archivo primero.');
            return;
        }

        const formData = new FormData();
        formData.append('archivo', file);

        setDuplicadoModalVisible(false);
        setLoading(true);
        setResumenData(null);
        setStatus({ 
            type: 'info', 
            msg: 'Procesando archivo en el servidor... Por favor, no cierre la pestaña.' 
        });

        try {
            const response = await axios.post(`${API_URL}/api/importar-excel`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            const dataResumen = response.data.resumen || response.data || {
                filasHoja1: 0,
                atencionesInsertadas: 0,
                beneficiariosNuevos: 0,
                efectoresNuevos: 0,
                nomencladoresInsertados: 0
            };

            const esDuplicado =
                Boolean(response.data?.alreadyImported) ||
                response.data?.status === 'duplicate' ||
                dataResumen?.alreadyImported === true ||
                dataResumen?.status === 'duplicate';

            setResumenData(dataResumen);

            if (esDuplicado) {
                setStatus({
                    type: 'warning',
                    msg: dataResumen.mensaje || response.data.mensaje || 'Este archivo ya fue importado anteriormente y no insertó registros nuevos.'
                });
                message.warning('El archivo ya se encontraba importado.');
            } else {
                setStatus({ 
                    type: 'success', 
                    msg: '¡Base de datos actualizada con éxito mediante el motor Python!' 
                });
                message.success('Importación finalizada con éxito.');
                setFile(null);
            }

            cargarHistorico();
        } catch (error) {
            console.error('Error en la carga:', error);
            const dataErr = error.response?.data;

            if (dataErr?.errorType === 'FORMAT_MISMATCH' || dataErr?.status === 'invalid_format') {
                const partes = [dataErr.mensaje || 'El formato del archivo Excel no coincide con la estructura esperada.'];
                if (dataErr.hojasFaltantes?.length) {
                    partes.push(`Hojas faltantes: ${dataErr.hojasFaltantes.join(', ')}.`);
                }
                if (dataErr.columnasFaltantesHoja1?.length) {
                    partes.push(`Columnas faltantes en Hoja1: ${dataErr.columnasFaltantesHoja1.join(', ')}.`);
                }
                if (dataErr.columnasFaltantesHoja3?.length) {
                    partes.push(`Columnas faltantes en Hoja3: ${dataErr.columnasFaltantesHoja3.join(', ')}.`);
                }

                setStatus({
                    type: 'error',
                    msg: partes.join(' ')
                });
                message.error('El formato del Excel no coincide con el formato esperado.');
            } else {
                setStatus({ 
                    type: 'error', 
                    msg: 'Hubo un fallo en la ejecución del proceso. Verifique el formato del Excel o la conexión con la base de datos.' 
                });
                message.error('Error al procesar el archivo.');
            }
        } finally {
            setLoading(false);
        }
    };

    const draggerProps = {
        name: 'archivo',
        multiple: false,
        accept: ".xlsx, .xlsm",
        beforeUpload: (fileSelected) => {
            setFile(fileSelected);
            setStatus({ type: '', msg: '' });
            setResumenData(null);
            setInfoDuplicado(null);
            verificarArchivoPrevio(fileSelected);
            return false;
        },
        onRemove: () => {
            limpiarSeleccion();
        },
        fileList: file ? [file] : [],
    };

    const getStatusIcon = () => {
        if (status.type === 'success') return <CheckCircleOutlined />;
        if (status.type === 'warning') return <WarningOutlined />;
        if (status.type === 'error') return <ExclamationCircleOutlined />;
        return <InfoCircleOutlined />;
    };

    const getAlertTitle = () => {
        if (status.type === 'success') return 'Éxito';
        if (status.type === 'warning') return 'Archivo ya importado';
        if (status.type === 'error') return 'Error de formato / proceso';
        return 'Aviso';
    };

    const columnsHistorico = [
        {
            title: '#ID',
            dataIndex: 'idHistorial',
            key: 'idHistorial',
        },
        {
            title: 'Periodo',
            dataIndex: 'periodo',
            key: 'periodo',
        },
        {
            title: 'Fecha y Hora de Carga',
            dataIndex: 'fechaCarga',
            key: 'fechaCarga',
            render: (fecha) => fecha ? new Date(fecha).toLocaleString() : '-'
        },
        {
            title: 'Filas Procesadas',
            dataIndex: 'filasHoja1',
            key: 'filasHoja1',
        },
        {
            title: 'Atenciones',
            dataIndex: 'atencionesInsertadas',
            key: 'atencionesInsertadas',
        },
        {
            title: 'Estado',
            dataIndex: 'estado',
            key: 'estado',
            render: (text) => <span style={{ color: '#3f8600', fontWeight: '500' }}>{text || 'Completado'}</span>
        }
    ];

    const ocupado = verificando || loading;

    return (
        <div style={{ padding: '30px 40px', maxWidth: '1300px', margin: '0 auto' }}>
            
            {/* Modal de Aviso Previo por Hash Ya Importado */}
            <Modal
                title={
                    <Space>
                        <WarningOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                        <span>Aviso: Archivo ya importado</span>
                    </Space>
                }
                open={duplicadoModalVisible}
                onCancel={limpiarSeleccion}
                footer={[
                    <Button key="cancelar" onClick={limpiarSeleccion}>
                        Cancelar importación
                    </Button>,
                    <Button key="continuar" type="primary" onClick={handleUpload}>
                        Procesar de todas formas
                    </Button>
                ]}
            >
                <p>
                    {infoDuplicado?.mensaje || 'Se detectó que este archivo ya fue procesado anteriormente en el historial de importaciones.'}
                </p>
                <ul style={{ paddingLeft: '20px', marginBottom: 0 }}>
                    <li><strong>Período:</strong> {infoDuplicado?.periodo || '-'}</li>
                    <li><strong>Fecha de carga:</strong> {infoDuplicado?.fechaCarga ? new Date(infoDuplicado.fechaCarga).toLocaleString() : '-'}</li>
                    <li><strong>Filas Hoja 1:</strong> {infoDuplicado?.filasHoja1 ?? '-'}</li>
                    <li><strong>ID Historial:</strong> #{infoDuplicado?.idHistorial ?? '-'}</li>
                </ul>
            </Modal>

            {/* Modal de Formato Esperado del Archivo Excel */}
            <Modal
                title={
                    <Space>
                        <TableOutlined style={{ color: '#1890ff', fontSize: '20px' }} />
                        <span>Formato esperado del archivo Excel (.xlsx / .xlsm)</span>
                    </Space>
                }
                open={formatoModalVisible}
                onCancel={() => setFormatoModalVisible(false)}
                width={760}
                footer={[
                    <Button key="cerrar" type="primary" onClick={() => setFormatoModalVisible(false)}>
                        Entendido
                    </Button>
                ]}
            >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Text>
                        El archivo debe incluir al menos las hojas <Text code>Hoja1</Text> y <Text code>Hoja3</Text> con los encabezados esperados por el motor de importación:
                    </Text>

                    <div>
                        <Text strong>Hoja1 (Atenciones / Prestaciones):</Text>
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {COLUMNAS_HOJA1.map((col) => (
                                <Tag key={col} color="blue">{col}</Tag>
                            ))}
                        </div>
                    </div>

                    <Divider style={{ margin: '8px 0' }} />

                    <div>
                        <Text strong>Hoja3 (Nomencladores):</Text>
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {COLUMNAS_HOJA3.map((col) => (
                                <Tag key={col} color="geekblue">{col}</Tag>
                            ))}
                        </div>
                    </div>
                </Space>
            </Modal>

            {/* Cabecera del Módulo */}
            <div style={{ marginBottom: '24px' }}>
                <Space align="center" size="middle">
                    <DashboardOutlined style={{ fontSize: '28px', color: '#1890ff' }} />
                    <div>
                        <Title level={2} style={{ margin: 0 }}>Sincronización de Periodo de Facturación</Title>
                        <Text type="secondary">
                            Actualización masiva de nomencladores, efectores, beneficiarios y atenciones mediante motor Python.
                        </Text>
                    </div>
                </Space>
                <Divider style={{ marginTop: '16px', marginBottom: '24px' }} />
            </div>

            {/* Fila Superior: Dos Columnas (Cargador y Resumen) */}
            <Row gutter={[24, 24]} align="stretch" style={{ marginBottom: '24px' }}>
                
                {/* COLUMNA IZQUIERDA: Formulario de Carga */}
                <Col xs={24} lg={10}>
                    <Card 
                        title="Subir Archivo Mensual"
                        extra={
                            <Button
                                type="link"
                                icon={<TableOutlined />}
                                onClick={() => setFormatoModalVisible(true)}
                                style={{ padding: 0 }}
                            >
                                Ver formato esperado
                            </Button>
                        }
                        bordered={false}
                        style={{ 
                            height: '100%', 
                            borderRadius: '12px', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.06)' 
                        }}
                    >
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            <Dragger {...draggerProps} disabled={ocupado} style={{ padding: '15px 0' }}>
                                <p className="ant-upload-drag-icon">
                                    <CloudUploadOutlined style={{ color: '#1890ff', fontSize: '42px' }} />
                                </p>
                                <p className="ant-upload-text">Haga clic o arrastre el Excel aquí</p>
                                <p className="ant-upload-hint">Formatos: .xlsx, .xlsm</p>
                            </Dragger>

                            {status.msg && (
                                <Alert
                                    message={getAlertTitle()}
                                    description={status.msg}
                                    type={status.type === 'info' ? 'info' : status.type}
                                    showIcon
                                    icon={getStatusIcon()}
                                />
                            )}

                            <Button
                                type="primary"
                                size="large"
                                block
                                icon={<CloudUploadOutlined />}
                                loading={ocupado}
                                onClick={handleUpload}
                                disabled={!file || ocupado}
                                style={{ 
                                    height: '50px', 
                                    borderRadius: '8px', 
                                    fontSize: '15px',
                                    fontWeight: '500' 
                                }}
                            >
                                {verificando
                                    ? 'Verificando archivo...'
                                    : loading
                                    ? 'Procesando en segundo plano...'
                                    : 'Iniciar Sincronización'}
                            </Button>
                        </Space>
                    </Card>
                </Col>

                {/* COLUMNA DERECHA: Resumen Estadístico */}
                <Col xs={24} lg={14}>
                    <Card 
                        title="Resumen de Resultados de la Carga"
                        bordered={false}
                        style={{ 
                            height: '100%', 
                            borderRadius: '12px', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                            backgroundColor: '#fafafa'
                        }}
                    >
                        {resumenData ? (
                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={12}>
                                        <Card size="small" style={{ borderRadius: '8px' }}>
                                            <Statistic title="Total Filas Hoja 1" value={resumenData.filasHoja1} prefix={<FileTextOutlined />} />
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card size="small" style={{ borderRadius: '8px' }}>
                                            <Statistic title="Atenciones Insertadas" value={resumenData.atencionesInsertadas} valueStyle={{ color: '#3f8600' }} prefix={<MedicineBoxOutlined />} />
                                        </Card>
                                    </Col>
                                </Row>
                                <Row gutter={[16, 16]}>
                                    <Col span={8}>
                                        <Card size="small" style={{ borderRadius: '8px' }}>
                                            <Statistic title="Beneficiarios" value={resumenData.beneficiariosNuevos} prefix={<UserAddOutlined />} />
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card size="small" style={{ borderRadius: '8px' }}>
                                            <Statistic title="Efectores" value={resumenData.efectoresNuevos} prefix={<TeamOutlined />} />
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card size="small" style={{ borderRadius: '8px' }}>
                                            <Statistic title="Nomencladores" value={resumenData.nomencladoresInsertados} />
                                        </Card>
                                    </Col>
                                </Row>
                            </Space>
                        ) : (
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                height: '220px', 
                                color: '#bfbfbf',
                                textAlign: 'center'
                            }}>
                                <FileTextOutlined style={{ fontSize: '48px', marginBottom: '12px' }} />
                                <Text type="secondary">Aún no se ha procesado ningún archivo en esta sesión.</Text>
                                <Text type="secondary" style={{ fontSize: '13px' }}>Los indicadores métricos aparecerán aquí al finalizar la importación.</Text>
                            </div>
                        )}
                    </Card>
                </Col>

            </Row>

            {/* Fila Inferior: Tabla de Historial de Importaciones */}
            <Row>
                <Col span={24}>
                    <Card 
                        title={
                            <Space>
                                <HistoryOutlined style={{ color: '#1890ff' }} />
                                <span>Historial de Periodos Cargados</span>
                            </Space>
                        }
                        bordered={false}
                        style={{ 
                            borderRadius: '12px', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.06)' 
                        }}
                    >
                        <Table 
                            dataSource={historico} 
                            columns={columnsHistorico} 
                            rowKey="idHistorial" 
                            loading={loadingHistorico}
                            pagination={{ pageSize: 5 }}
                            size="middle"
                            locale={{ emptyText: 'No hay registros históricos disponibles.' }}
                        />
                    </Card>
                </Col>
            </Row>

        </div>
    );
};

export default UpdatePeriodoFacturacion;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Button, Upload, Typography, message, Alert, Space, Divider, Row, Col, Statistic, Table } from 'antd';
import { 
    CloudUploadOutlined, 
    CheckCircleOutlined, 
    ExclamationCircleOutlined, 
    InfoCircleOutlined, 
    FileTextOutlined, 
    UserAddOutlined, 
    TeamOutlined, 
    MedicineBoxOutlined,
    DashboardOutlined,
    HistoryOutlined 
} from '@ant-design/icons';
import API_URL from '../config';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const UpdatePeriodoFacturacion = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });
    const [resumenData, setResumenData] = useState(null);
    const [historico, setHistorico] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    // Cargar el historial al montar el componente
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

    const handleUpload = async () => {
        if (!file) {
            message.warning('Por favor, seleccione un archivo primero.');
            return;
        }

        const formData = new FormData();
        formData.append('archivo', file);

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
            
            const dataResumen = response.data.resumen || {
                filasHoja1: 0,
                atencionesInsertadas: 0,
                beneficiariosNuevos: 0,
                efectoresNuevos: 0,
                nomencladoresInsertados: 0
            };

            setResumenData(dataResumen);
            setStatus({ 
                type: 'success', 
                msg: '¡Base de datos actualizada con éxito mediante el motor Python!' 
            });
            message.success('Importación finalizada con éxito.');
            setFile(null); 
            cargarHistorico(); // Recargar la tabla histórica automáticamente
        } catch (error) {
            console.error('Error en la carga:', error);
            setStatus({ 
                type: 'error', 
                msg: 'Hubo un fallo en la ejecución del proceso. Verifique el formato del Excel o la conexión con la base de datos.' 
            });
            message.error('Error al procesar el archivo.');
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
            return false;
        },
        onRemove: () => {
            setFile(null);
            setStatus({ type: '', msg: '' });
            setResumenData(null);
        },
        fileList: file ? [file] : [],
    };

    const getStatusIcon = () => {
        if (status.type === 'success') return <CheckCircleOutlined />;
        if (status.type === 'error') return <ExclamationCircleOutlined />;
        return <InfoCircleOutlined />;
    };

    // Columnas de la tabla histórica
    const columnsHistorico = [
        {
            title: '#ID',
            dataIndex: 'idHistorial',
            key: 'idHistorial',
        },
        {
            title: 'Periodo',
            dataIndex: 'nombreArchivo',
            key: 'nombreArchivo',
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

    return (
        <div style={{ padding: '30px 40px', maxWidth: '1300px', margin: '0 auto' }}>
            
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
                        bordered={false}
                        style={{ 
                            height: '100%', 
                            borderRadius: '12px', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.06)' 
                        }}
                    >
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            <Dragger {...draggerProps} disabled={loading} style={{ padding: '15px 0' }}>
                                <p className="ant-upload-drag-icon">
                                    <CloudUploadOutlined style={{ color: '#1890ff', fontSize: '42px' }} />
                                </p>
                                <p className="ant-upload-text">Haga clic o arrastre el Excel aquí</p>
                                <p className="ant-upload-hint">Formatos: .xlsx, .xlsm</p>
                            </Dragger>

                            {status.msg && (
                                <Alert
                                    message={status.type === 'success' ? 'Éxito' : status.type === 'error' ? 'Error' : 'Aviso'}
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
                                loading={loading}
                                onClick={handleUpload}
                                disabled={!file}
                                style={{ 
                                    height: '50px', 
                                    borderRadius: '8px', 
                                    fontSize: '15px',
                                    fontWeight: '500' 
                                }}
                            >
                                {loading ? 'Procesando en segundo plano...' : 'Iniciar Sincronización'}
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
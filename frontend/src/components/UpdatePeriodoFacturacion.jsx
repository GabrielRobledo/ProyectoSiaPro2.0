import React, { useState } from 'react';
import axios from 'axios';
import { Card, Button, Upload, Typography, message, Alert, Space, Divider, Row, Col, Statistic } from 'antd';
import { 
    CloudUploadOutlined, 
    CheckCircleOutlined, 
    ExclamationCircleOutlined, 
    InfoCircleOutlined, 
    FileTextOutlined, 
    UserAddOutlined, 
    TeamOutlined, 
    MedicineBoxOutlined 
} from '@ant-design/icons';
import API_URL from '../config';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const UpdatePeriodoFacturacion = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });
    const [resumenData, setResumenData] = useState(null);

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
            
            // Capturamos el resumen devuelto por el backend (generado por Python)
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
                msg: '¡Base de datos actualizada con éxito mediante el script de Python!' 
            });
            message.success('Importación finalizada con éxito.');
            setFile(null); 
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

    return (
        <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
            <Card 
                style={{ 
                    width: '100%', 
                    maxWidth: '750px', 
                    borderRadius: '12px', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)' 
                }}
            >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div style={{ textAlign: 'center' }}>
                        <Title level={3} style={{ marginBottom: '8px' }}>Sincronización de Periodo</Title>
                        <Text type="secondary">
                            Actualización masiva de beneficiarios, efectores y nomencladores mediante motor Python.
                        </Text>
                    </div>

                    <Divider style={{ margin: '0' }} />

                    <Dragger {...draggerProps} disabled={loading}>
                        <p className="ant-upload-drag-icon">
                            <CloudUploadOutlined style={{ color: '#1890ff', fontSize: '48px' }} />
                        </p>
                        <p className="ant-upload-text">Haga clic o arrastre el archivo Excel aquí</p>
                        <p className="ant-upload-hint">
                            Formatos permitidos: .xlsx, .xlsm.
                        </p>
                    </Dragger>

                    {status.msg && (
                        <Alert
                            message={status.type === 'success' ? 'Operación Exitosa' : status.type === 'error' ? 'Error de Proceso' : 'Información'}
                            description={status.msg}
                            type={status.type === 'info' ? 'info' : status.type}
                            showIcon
                            icon={getStatusIcon()}
                        />
                    )}

                    {/* Resumen Estadístico post-carga */}
                    {resumenData && (
                        <Card type="inner" title="Resumen de la Importación Actual" style={{ backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Statistic title="Total Filas Hoja 1" value={resumenData.filasHoja1} prefix={<FileTextOutlined />} />
                                </Col>
                                <Col span={8}>
                                    <Statistic title="Atenciones Insertadas" value={resumenData.atencionesInsertadas} valueStyle={{ color: '#3f8600' }} prefix={<MedicineBoxOutlined />} />
                                </Col>
                                <Col span={8}>
                                    <Statistic title="Beneficiarios Nuevos" value={resumenData.beneficiariosNuevos} prefix={<UserAddOutlined />} />
                                </Col>
                            </Row>
                            <Row gutter={16} style={{ marginTop: '16px' }}>
                                <Col span={12}>
                                    <Statistic title="Efectores Nuevos" value={resumenData.efectoresNuevos} prefix={<TeamOutlined />} />
                                </Col>
                                <Col span={12}>
                                    <Statistic title="Nomencladores Nuevos" value={resumenData.nomencladoresInsertados} />
                                </Col>
                            </Row>
                        </Card>
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
                            height: '55px', 
                            borderRadius: '8px', 
                            fontSize: '16px',
                            fontWeight: '500' 
                        }}
                    >
                        {loading ? 'Ejecutando proceso en segundo plano...' : 'Iniciar Sincronización'}
                    </Button>
                </Space>
            </Card>
        </div>
    );
};

export default UpdatePeriodoFacturacion;
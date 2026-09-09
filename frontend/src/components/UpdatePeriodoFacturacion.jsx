import React, { useState } from 'react';
import axios from 'axios';
import { Card, Button, Upload, Typography, message, Alert, Space, Divider } from 'antd';
import { CloudUploadOutlined, CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import API_URL from '../config';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// Definición con PascalCase para evitar warnings de React
const UpdatePeriodoFacturacion = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });

    const handleUpload = async () => {
        if (!file) {
            message.warning('Por favor, seleccione un archivo primero.');
            return;
        }

        const formData = new FormData();
        formData.append('archivo', file);

        setLoading(true);
        setStatus({ 
            type: 'info', 
            msg: 'Procesando archivo en el servidor... Por favor, no cierre la pestaña.' 
        });

        try {
            await axios.post(`${API_URL}/api/importar-excel`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
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
            return false; // Importante: evita la subida automática inmediata
        },
        onRemove: () => {
            setFile(null);
            setStatus({ type: '', msg: '' });
        },
        fileList: file ? [file] : [],
    };

    // Función auxiliar para determinar el icono del Alert según el estado
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
                    maxWidth: '700px', 
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
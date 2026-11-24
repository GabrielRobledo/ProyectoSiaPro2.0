const express = require('express');
const router = express.Router();
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db/conexion');

const upload = multer({ dest: 'uploads/' });

function limpiarArchivoTemporal(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            console.error('No se pudo eliminar el archivo temporal:', err);
        }
    }
}

function extraerUltimoJson(output) {
    if (!output) return null;
    const lineas = output
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    for (let i = lineas.length - 1; i >= 0; i--) {
        try {
            return JSON.parse(lineas[i]);
        } catch (_) {
            // Continuar buscando hacia atrás si hubo líneas de log
        }
    }
    return null;
}

function calcularSha256Archivo(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

function buscarImportacionPrevia(hashArchivo) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT idHistorial, periodo, fechaCarga, filasHoja1, atencionesInsertadas, estado, hashArchivo
            FROM historial_importaciones
            WHERE hashArchivo = ? AND estado = 'Completado'
            ORDER BY idHistorial DESC
            LIMIT 1
        `;
        db.query(query, [hashArchivo], (err, results) => {
            if (err) return reject(err);
            resolve(results && results.length > 0 ? results[0] : null);
        });
    });
}

function getPythonExecutable() {
    const venvPython = path.join(__dirname, '../venv/bin/python');
    return fs.existsSync(venvPython) ? venvPython : 'python';
}

// 1. Endpoint rápido para verificar si el archivo ya fue importado antes de procesar
router.post('/verificar-archivo', upload.single('archivo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió archivo' });
    }

    const filePath = req.file.path;

    try {
        const hashArchivo = await calcularSha256Archivo(filePath);
        const registroPrevio = await buscarImportacionPrevia(hashArchivo);

        if (registroPrevio) {
            return res.status(200).json({
                alreadyImported: true,
                status: 'duplicate',
                hashArchivo,
                registroPrevio,
                mensaje: `Este archivo ya fue importado para el período ${registroPrevio.periodo} (carga #${registroPrevio.idHistorial}).`
            });
        }

        return res.status(200).json({
            alreadyImported: false,
            status: 'ok',
            hashArchivo
        });
    } catch (error) {
        console.error('Error al verificar hash del archivo:', error);
        return res.status(500).json({ error: 'Error al verificar el archivo' });
    } finally {
        limpiarArchivoTemporal(filePath);
    }
});

// 2. Endpoint principal de importación
router.post('/importar-excel', upload.single('archivo'), async (req, res) => {
    if (!req.file) return res.status(400).send('No se subió archivo');

    const scriptPath = path.join(__dirname, '../scripts/actualizar_db.py');
    const filePath = req.file.path;
    const pythonExecutable = getPythonExecutable();

    let hashArchivo = '';
    try {
        hashArchivo = await calcularSha256Archivo(filePath);
    } catch (err) {
        console.error('Error calculando SHA-256:', err);
    }

    const args = hashArchivo ? [scriptPath, filePath, hashArchivo] : [scriptPath, filePath];
    const pythonProcess = spawn(pythonExecutable, args, {
        env: process.env,
    });

    let errorData = '';
    let outputData = '';

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        limpiarArchivoTemporal(filePath);

        const jsonSalida = extraerUltimoJson(outputData);

        if (code === 0) {
            if (jsonSalida) {
                const esDuplicado =
                    Boolean(jsonSalida.alreadyImported) ||
                    jsonSalida.status === 'duplicate' ||
                    Number(jsonSalida.atencionesInsertadas || 0) === 0;

                return res.status(200).json({
                    message: esDuplicado ? 'Archivo ya importado previamente' : 'Proceso exitoso',
                    status: esDuplicado ? 'duplicate' : 'success',
                    alreadyImported: esDuplicado,
                    resumen: {
                        ...jsonSalida,
                        alreadyImported: esDuplicado,
                        status: esDuplicado ? 'duplicate' : 'success'
                    }
                });
            }

            return res.status(200).json({
                message: 'Proceso exitoso',
                status: 'success',
                alreadyImported: false,
                resumen: {
                    filasHoja1: 0,
                    atencionesInsertadas: 0,
                    beneficiariosNuevos: 0,
                    efectoresNuevos: 0,
                    nomencladoresInsertados: 0
                }
            });
        } else {
            console.error('DETALLE DEL ERROR EN PYTHON:', errorData);

            if (jsonSalida?.errorType === 'FORMAT_MISMATCH' || jsonSalida?.status === 'invalid_format') {
                return res.status(422).json(jsonSalida);
            }

            return res.status(500).json({
                error: 'Error en el script de Python',
                trace: errorData
            });
        }
    });
});

// Endpoint para consultar el historial de importaciones
router.get('/periodos-historicos', (req, res) => {
    const query = 'SELECT * FROM historial_importaciones ORDER BY fechaCarga DESC LIMIT 10';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener el historial:', err);
            return res.status(500).json({ error: 'Error al consultar la base de datos' });
        }
        res.json(results);
    });
});

module.exports = router;
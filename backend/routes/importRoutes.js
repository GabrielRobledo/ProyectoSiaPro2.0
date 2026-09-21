const express = require('express');
const router = express.Router();
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

router.post('/importar-excel', upload.single('archivo'), (req, res) => {
    if (!req.file) return res.status(400).send('No se subió archivo');

    const scriptPath = path.join(__dirname, '../scripts/actualizar_db.py');
    const filePath = req.file.path;

    const venvPython = path.join(__dirname, '../venv/bin/python');
    const pythonExecutable = fs.existsSync(venvPython) ? venvPython : 'python';

    const pythonProcess = spawn(pythonExecutable, [scriptPath, filePath], {
        env: process.env,
    });

    let errorData = "";
    let outputData = ""; // <--- 1. Variable para acumular la salida estándar de Python

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString(); // <--- 2. Capturamos los prints de Python
    });

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        // Limpiamos el archivo temporal siempre
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        if (code === 0) {
            try {
                // 3. Buscamos la última línea impresa por Python que contiene el JSON del resumen
                const lineas = outputData.trim().split('\n');
                const ultimaLinea = lineas[lineas.length - 1];
                const resumen = JSON.parse(ultimaLinea);

                // 4. Respondemos al frontend enviando el objeto de resumen
                res.status(200).json({ 
                    message: 'Proceso exitoso',
                    resumen: resumen 
                });
            } catch (parseError) {
                // Por si el script imprimió otra cosa al final y no se pudo parsear como JSON
                res.status(200).json({ 
                    message: 'Proceso exitoso',
                    resumen: { filasHoja1: 0, atencionesInsertadas: 0, beneficiariosNuevos: 0, efectoresNuevos: 0, nomencladoresInsertados: 0 } 
                });
            }
        } else {
            console.error("DETALLE DEL ERROR EN PYTHON:", errorData);
            res.status(500).json({ 
                error: 'Error en el script de Python', 
                trace: errorData 
            });
        }
    });
});

module.exports = router;
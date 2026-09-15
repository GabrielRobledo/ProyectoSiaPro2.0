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

    // Detectar automáticamente si estamos en Render (usa el venv) o en tu PC (usa python global)
    const venvPython = path.join(__dirname, '../../venv/bin/python');
    const pythonExecutable = fs.existsSync(venvPython) ? venvPython : 'python';

    const pythonProcess = spawn(pythonExecutable, [scriptPath, filePath]);

    let errorData = "";

    pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        // Limpiamos el archivo temporal siempre
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        if (code === 0) {
            res.status(200).json({ message: 'Proceso exitoso' });
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
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/altaUserModels');
const LogModel = require('../models/logsModels');

async function verificarRecaptcha(token, remoteIp) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  if (!secret) {
    return { ok: false, status: 500, msg: 'Falta RECAPTCHA_SECRET_KEY en Render.' };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return { ok: false, status: 400, msg: 'Marcá la casilla reCAPTCHA.' };
  }

  const params = new URLSearchParams({
    secret,
    response: token.trim(),
  });
  if (remoteIp) params.append('remoteip', remoteIp);

  try {
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await resp.json();

    if (!data.success) {
      return {
        ok: false,
        status: 400,
        msg: 'Verificación reCAPTCHA inválida o expirada. Volvé a marcarla.',
      };
    }

    return { ok: true };
  } catch (err) {
    console.error('Error al verificar reCAPTCHA:', err);
    return { ok: false, status: 502, msg: 'Error al validar reCAPTCHA.' };
  }
}

const login = async (req, res) => {
  const { usuario, contraseña, captchaToken } = req.body;
  const ipCliente = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

  const checkCaptcha = await verificarRecaptcha(captchaToken, ipCliente);
  if (!checkCaptcha.ok) {
    return res.status(checkCaptcha.status).json({ msg: checkCaptcha.msg });
  }

  Usuario.getUserByUsername(usuario, (err, user) => {
    if (err) {
      console.error('Error al buscar usuario:', err);
      return res.status(500).json({ msg: 'Error del servidor' });
    }

    if (!user) {
      return res.status(401).json({ msg: 'Usuario no encontrado' });
    }

    bcrypt.compare(contraseña, user['contraseña'], (err, isMatch) => {
      if (err) {
        console.error('Error al comparar contraseñas:', err);
        return res.status(500).json({ msg: 'Error al verificar credenciales' });
      }

      if (!isMatch) {
        return res.status(401).json({ msg: 'Credenciales inválidas' });
      }

      const token = jwt.sign(
        {
          idUsuario: user.idUsuario,
          nombre: user.nombre,
          usuario: user.usuario,
          idTipoUsuario: user.idTipoUsuario,
          tipo: user.rol ? user.rol.toLowerCase().trim() : 'invitado',
        },
        process.env.JWT_SECRET || 'tu_secreto_jwt',
        { expiresIn: '1h' }
      );

      const userResponse = {
        idUsuario: user.idUsuario,
        nombre: user.nombre,
        usuario: user.usuario,
        idTipoUsuario: user.idTipoUsuario,
        rol: user.rol ? user.rol.toLowerCase().trim() : 'invitado',
      };

      res.json({ msg: 'Login exitoso', token, user: userResponse });

      LogModel.crearLog(
        {
          idUsuario: user.idUsuario,
          accion: 'Inicio de sesión',
          resultado: 'Exito',
          descripcion: 'El usuario inició sesión correctamente.',
        },
        (logErr) => {
          if (logErr) console.error('Error al registrar log:', logErr);
        }
      );
    });
  });
};

module.exports = { login };
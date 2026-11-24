const axios = require('axios');

const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';

const verifyCaptcha = async (req, res, next) => {
  const { captchaToken } = req.body;

  if (!captchaToken) {
    return res.status(400).json({ msg: 'Captcha requerido.' });
  }

  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.error('Falta la variable RECAPTCHA_SECRET_KEY');
    return res.status(500).json({ msg: 'Error de configuración del servidor.' });
  }

  try {
    const params = new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: captchaToken,
    });

    const { data } = await axios.post(RECAPTCHA_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000,
    });

    if (!data.success) {
      console.warn('reCAPTCHA rechazado:', data['error-codes']);
      return res.status(400).json({ msg: 'Captcha inválido o expirado. Intenta nuevamente.' });
    }

    next();
  } catch (error) {
    console.error('Error verificando reCAPTCHA:', error.message);
    return res.status(500).json({ msg: 'No se pudo verificar el captcha.' });
  }
};

module.exports = verifyCaptcha;
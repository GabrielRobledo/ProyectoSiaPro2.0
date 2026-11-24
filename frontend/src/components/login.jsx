import { useState, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import ReCAPTCHA from 'react-google-recaptcha';
import '../styles/login.css';
import API_URL from '../config';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useUser } from './contextUsers';

function Login() {
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);
  const navigate = useNavigate();
  const { setUser } = useUser();

  const toggleMostrarPassword = () => setMostrarPassword((prev) => !prev);

  const resetCaptcha = () => {
    recaptchaRef.current?.reset();
    setCaptchaToken(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!usuario.trim() || !contraseña.trim()) {
      Swal.fire({
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
      });
      return;
    }

    if (!captchaToken) {
      Swal.fire({
        title: 'Captcha requerido',
        text: 'Por favor confirma que no eres un robot.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
      });
      return;
    }

    setCargando(true);

    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        usuario,
        contraseña,
        captchaToken,
      });

      const { token, user } = response.data;
      const rol = user.rol.toLowerCase().trim();

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('rol', rol);
      setUser(user);

      await Swal.fire({
        title: '¡Login exitoso!',
        text: 'Has iniciado sesión correctamente.',
        icon: 'success',
        confirmButtonText: 'Continuar',
      });

      if (rol === 'administrador') {
        navigate('/dashboard');
      } else if (rol === 'auditor') {
        navigate('/dashboardAuditor');
      }
    } catch (err) {
      Swal.fire({
        title: 'Error de login',
        text:
          err.response?.data?.message ||
          'Credenciales incorrectas o error del servidor.',
        icon: 'error',
        confirmButtonText: 'Intentar nuevamente',
      });
      // El token es de un solo uso: siempre se resetea tras un intento fallido
      resetCaptcha();
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-info">
        <h1>SiaPro Audit</h1>
        <p>
          Bienvenido al sistema de auditoría de atenciones médicas. Controla,
          supervisa y mejora la calidad de atención en instituciones de salud
          con eficiencia, precisión y trazabilidad.
        </p>
      </div>

      <div className="login-form-container">
        <img src="/logo1.png" alt="Logo SiaPro Audit" className="login-logo" />
        <h2 className="title">Iniciar Sesión</h2>

        <form className="login-form" onSubmit={handleLogin}>
          <label htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="input"
            required
          />

          <label htmlFor="contraseña">Contraseña</label>
          <div className="password-container">
            <input
              id="contraseña"
              type={mostrarPassword ? 'text' : 'password'}
              value={contraseña}
              onChange={(e) => setContraseña(e.target.value)}
              className="input password-input"
              required
            />
            <button
              type="button"
              className="toggle-password"
              onClick={toggleMostrarPassword}
              aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {mostrarPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <div className="recaptcha-container">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
              onChange={(token) => setCaptchaToken(token)}
              onExpired={() => setCaptchaToken(null)}
              onErrored={() => setCaptchaToken(null)}
              hl="es"
            />
          </div>

          <button
            type="submit"
            className="button"
            disabled={cargando || !captchaToken}
          >
            {cargando ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
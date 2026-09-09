const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // --- 1. ROL: ADMINISTRADOR ---
  await page.goto('http://localhost:5173/login');
  await page.fill('#usuario', 'lsi.rga@gmail.com');
  await page.fill('#contraseña', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/dashboard');

  const accionesAdmin = [
    { texto: 'Usuarios', url: '/usuarios', nombre: 'admin_02_gestion_usuarios' },
    { texto: 'Cierre Auditoria', url: '/cierreDeAuditoria', nombre: 'admin_03_gestion_cierres' },
    { texto: 'Novedades', url: '/novedades', nombre: 'admin_04_gestion_novedades' },
    { texto: 'Actualizar Periodo', url: '/actualizar-datos', nombre: 'admin_05_actualizar_periodo' },
    { texto: 'Registrar Usuario', url: '/register', nombre: 'admin_06_registrousuarios' }
  ];

  for (const item of accionesAdmin) {
    // Hace clic directamente en el texto del menú lateral para navegar de forma natural en React
    await page.click(`text=${item.texto}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `./capturas_tesis/${item.nombre}.png`, fullPage: true });
  }

  // Ir al logout o limpiar sesión
  await page.goto('http://localhost:5173/logout');

 // --- 2. ROL: AUDITOR ---
  await page.goto('http://localhost:5173/login');
  await page.fill('#usuario', 'luz-picon@uep.com');
  await page.fill('#contraseña', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/dashboardAuditor');

  // 1. Capturar Dashboard del Auditor
  await page.click('text=Dashboard Auditor');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: './capturas_tesis/auditor_01_dashboard.png', fullPage: true });

  // 2. Desplegar menú "Auditorías" y recorrer sus submenús
  await page.click('text=Auditorias');
  await page.waitForTimeout(500); // Pequeña pausa para que se despliegue la animación del menú

  const submenusAuditorias = [
    { texto: 'Pendientes', nombre: 'auditor_02_auditorias_pendientes' },
    { texto: 'Parciales', nombre: 'auditor_03_auditorias_parciales' },
    { texto: 'Finalizados', nombre: 'auditor_04_auditorias_finalizados' },
    
  ];

  for (const item of submenusAuditorias) {
    await page.click(`text=${item.texto}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `./capturas_tesis/${item.nombre}.png`, fullPage: true });
  }

  console.log('¡Capturas de Administrador y Auditor generadas con éxito!');
  await browser.close();
})();
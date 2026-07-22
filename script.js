/* ============================================================
   Biblioteca Digital CUNOC – Trabajo Social
   script.js – Refactorizado con hashing SHA-256 y panel admin corregido
   ============================================================ */

const DEBUG_PREFIX = '[CUNOC]';
const KEYS = {
    docs:    'biblioteca_docs_v3',
    anns:    'biblioteca_anns_v3',
    session: 'biblioteca_session_v3',
    msgs:    'biblioteca_msgs_v3',
    social:  'biblioteca_social_v1'
};

/* ============================================================
   SEGURIDAD Y SESIÓN (API centralizada)
   ============================================================ */

function sanitizeSessionUser(user) {
    const safe = {
        id: user.id,
        name: user.name,
        role: user.role || 'student'
    };
    if (user.carne) safe.carne = user.carne;
    if (user.muted) safe.muted = user.muted;
    if (user.token) safe.token = user.token;
    if (user.isAdmin) safe.isAdmin = true;
    return safe;
}

function authHeaders(json = true) {
    const headers = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (currentUser?.token) headers.Authorization = `Bearer ${currentUser.token}`;
    return headers;
}

async function verifySession(token) {
    try {
        const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await response.json();
        return data.success ? data : null;
    } catch (err) {
        console.error(`${DEBUG_PREFIX} Error verificando sesión:`, err);
        return null;
    }
}

async function fetchStudents() {
    const response = await fetch('/api/students', { headers: authHeaders(false) });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'No se pudo cargar estudiantes');
    return data.students || [];
}

/* ============================================================
   DATOS POR DEFECTO Y STORAGE
   ============================================================ */
const store = {
    get(key) {
        try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; }
        catch (e) { console.error(`${DEBUG_PREFIX} Error leyendo ${key}:`, e); localStorage.removeItem(key); return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); }
        catch (e) { console.error(`${DEBUG_PREFIX} Error guardando ${key}:`, e); }
    }
};

// Inicializar datos locales (docs/avisos/mensajes — Fase 2 migrará a servidor)
if (!store.get(KEYS.docs))   store.set(KEYS.docs, []);
if (!store.get(KEYS.anns))   store.set(KEYS.anns, []);
if (!store.get(KEYS.msgs))   store.set(KEYS.msgs, []);

let currentUser        = null;
let currentFilter      = 'all';
let studentSessionDocs = 0;
let studentSessionAnns = 0;

/* ============================================================
   NAVEGACIÓN ENTRE VISTAS INSTITUCIONALES
   ============================================================ */
function switchMainView(viewName) {
    closeMobileNav();
    // Ocultar panel admin si está visible
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.classList.add('hidden');

    document.querySelectorAll('.main-view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (viewName === 'biblioteca') {
        // Mostrar la vista pública y el tab de inicio
        document.getElementById('public-view')?.classList.remove('hidden');
        setExclusiveTab('inicio');
    } else if (viewName === 'aetsro') {
        restartAetsroGif();
        // Aplicar interactividad a las imágenes de AETSRO
        setTimeout(() => applyImageInteractivity(target), 100);
    } else if (viewName === 'consejo') {
        restartConsejoGif();
        // Aplicar interactividad a las imágenes del Consejo
        setTimeout(() => applyImageInteractivity(target), 100);
    }
}

/* ============================================================
   NAVEGACIÓN EXCLUSIVA POR DROPDOWN
   ============================================================ */
function setExclusiveTab(tabName) {
    // Ocultar panel admin
    document.getElementById('admin-panel')?.classList.add('hidden');
    // Asegurar que la vista pública está visible
    document.getElementById('public-view')?.classList.remove('hidden');
    // Asegurar que la vista biblioteca está activa
    document.querySelectorAll('.main-view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-biblioteca')?.classList.remove('hidden');

    // Ocultar todas las pestañas
    document.querySelectorAll('#view-biblioteca .tab-content').forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('active');
    });

    // Mostrar solo la seleccionada
    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) {
        tab.classList.remove('hidden');
        tab.classList.add('active');
    }

    if (tabName === 'inicio') {
        restartHeroGif();
    } else if (tabName === 'plataforma') {
        renderAll();
    }
}

/* ============================================================
   AUTENTICACIÓN DE ESTUDIANTES (Supabase vía API)
   ============================================================ */
async function handleAuth(e) {
    e.preventDefault();
    const isLogin = !document.getElementById('login-form').classList.contains('hidden');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; }

    try {
        if (isLogin) {
            const carne    = document.getElementById('login-carne').value.trim();
            const password = document.getElementById('login-password').value;
            const response = await fetch('/api/auth/student-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ carne, password })
            });
            const data = await response.json();
            if (!data.success) {
                alert(data.message || 'Carné o contraseña incorrectos');
                return;
            }
            loginSuccess(sanitizeSessionUser({ ...data.user, token: data.token }));
        } else {
            const name     = document.getElementById('reg-name').value.trim();
            const carne    = document.getElementById('reg-carne').value.trim();
            const password = document.getElementById('reg-password').value;
            const response = await fetch('/api/auth/student-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, carne, password })
            });
            const data = await response.json();
            if (!data.success) {
                alert(data.message || 'No se pudo completar el registro');
                return;
            }
            alert('Registro exitoso. Entrando a la biblioteca.');
            loginSuccess(sanitizeSessionUser({ ...data.user, token: data.token }));
            e.target.reset();
        }
    } catch (err) {
        console.error(`${DEBUG_PREFIX} Error de autenticación:`, err);
        alert('Error de conexión. Verifica que el servidor esté activo y Supabase configurado.');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

/* ============================================================
   AUTENTICACIÓN ADMIN CON HASHING ASÍNCRONO
   ============================================================ */
async function handleAdminAccess(e) {
    e.preventDefault();
    const btn      = e.target.querySelector('button[type="submit"]');
    const nombre   = document.getElementById('admin-name').value.trim();
    const cargo    = document.getElementById('admin-role').value;
    const password = document.getElementById('admin-password').value;

    if (!cargo) { alert('Selecciona un cargo'); return; }
    if (!nombre || !password) { alert('Por favor complete todos los campos'); return; }

    // Deshabilitar botón mientras se procesa la autenticación
    btn.disabled    = true;
    btn.textContent = 'Verificando...';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nombre, cargo, password })
        });

        const data = await response.json();

        if (data.success) {
            const adminUser = sanitizeSessionUser({
                id: Date.now(),
                name: data.usuario,
                role: data.cargo,
                isAdmin: true,
                token: data.token
            });
            loginSuccess(adminUser);
            closeAdminModal();
            e.target.reset();
        } else {
            alert(data.message || 'Credenciales inválidas');
        }
    } catch (err) {
        console.error(`${DEBUG_PREFIX} Error en validación admin:`, err);
        alert('Error de conexión. Intente nuevamente.');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Acceder como Admin';
    }
}

/* ============================================================
   LOGIN / LOGOUT
   ============================================================ */
function loginSuccess(user) {
    const sessionUser = sanitizeSessionUser(user);
    currentUser = sessionUser;
    store.set(KEYS.session, sessionUser);

    document.getElementById('welcome-screen')?.classList.add('hidden');
    document.getElementById('auth-modal')?.classList.add('hidden');
    document.getElementById('app-header')?.classList.remove('hidden');
    document.getElementById('public-view')?.classList.remove('hidden');
    document.getElementById('app-footer')?.classList.remove('hidden');
    document.getElementById('admin-panel')?.classList.add('hidden');

    updateHeaderUI();
    switchMainView('biblioteca');
    renderAll();
    // Start guided tour after UI is rendered
    startHeaderTour();
    // initCarousels() — carrusel eliminado de la vista pública
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem(KEYS.session);
    document.getElementById('welcome-screen')?.classList.remove('hidden');
    document.getElementById('app-header')?.classList.add('hidden');
    document.getElementById('public-view')?.classList.add('hidden');
    document.getElementById('app-footer')?.classList.add('hidden');
    document.getElementById('admin-panel')?.classList.add('hidden');
    closeAuthModal();
    document.getElementById('login-form')?.reset();
    document.getElementById('register-form')?.reset();
    studentSessionDocs = 0;
    studentSessionAnns = 0;
}

/* ============================================================
   UI Y MODALES
   ============================================================ */
function showAuthModal() {
    const m = document.getElementById('auth-modal');
    if (m) { m.classList.remove('hidden'); m.style.display = 'flex'; }
}
function closeAuthModal() {
    const m = document.getElementById('auth-modal');
    if (m) { m.classList.add('hidden'); m.style.display = 'none'; }
}
function openAdminModal() {
    const m = document.getElementById('admin-modal');
    if (m) { m.classList.remove('hidden'); m.style.display = 'flex'; }
}
function closeAdminModal() {
    const m = document.getElementById('admin-modal');
    if (m) { m.classList.add('hidden'); m.style.display = 'none'; }
}
function switchAuthTab(mode) {
    const loginForm    = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${mode}"]`)?.classList.add('active');
    if (mode === 'login') { loginForm?.classList.remove('hidden'); registerForm?.classList.add('hidden'); }
    else                  { loginForm?.classList.add('hidden');    registerForm?.classList.remove('hidden'); }
}

function updateHeaderUI() {
    if (!currentUser) return;
    const adminPanelBtn = document.getElementById('btn-admin-panel');
    if (adminPanelBtn) {
        adminPanelBtn.classList.toggle('hidden', !(currentUser.isAdmin && currentUser.token));
    }
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) welcomeMsg.textContent = `Bienvenido, ${currentUser.name}`;
}

function restartHeroGif() {
    const heroGif = document.getElementById('hero-gif-bg');
    if (!heroGif) return;

    if (heroGif.gifTimeout) {
        clearTimeout(heroGif.gifTimeout);
    }

    // Evitar almacenamiento en caché para forzar el reinicio de la animación del GIF y mantenerlo animado de forma continua
    heroGif.src = 'imags/usac1_hd.gif?t=' + Date.now();
}

function restartAetsroGif() {
    const aetsroGif = document.getElementById('aetsro-gif-bg');
    if (!aetsroGif) return;

    if (aetsroGif.gifTimeout) {
        clearTimeout(aetsroGif.gifTimeout);
    }

    // Evitar almacenamiento en caché para forzar el reinicio de la animación del GIF y mantenerlo animado de forma continua
    aetsroGif.src = 'imags/aetsro_hd.gif?t=' + Date.now();
}

function restartConsejoGif() {
    const consejoGif = document.getElementById('consejo-gif-bg');
    if (!consejoGif) return;

    if (consejoGif.gifTimeout) {
        clearTimeout(consejoGif.gifTimeout);
    }

    // Evitar caché para reiniciar la animación del GIF y mantenerlo animado de forma continua
    consejoGif.src = 'imags/huelga.gif?t=' + Date.now();
}


function toggleDark() {
    document.body.classList.toggle('dark');
    document.documentElement.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('cunoc_theme', isDark ? 'dark' : 'light');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

function applyStoredTheme() {
    const saved = localStorage.getItem('cunoc_theme');
    if (saved === 'dark') {
        document.body.classList.add('dark');
        document.documentElement.classList.add('dark');
        const btn = document.getElementById('btn-theme');
        if (btn) btn.textContent = '☀️';
    }
}

function scrollToSection(id) {
    // Asegurar que la vista de biblioteca y la vista pública están visibles
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.classList.add('hidden');
    
    document.querySelectorAll('.main-view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-biblioteca')?.classList.remove('hidden');
    document.getElementById('public-view')?.classList.remove('hidden');

    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 150);
}

/* ============================================================
   PANEL DE ADMINISTRACIÓN (CORREGIDO)
   ============================================================ */
async function toggleAdminPanel() {
    if (!currentUser?.token) {
        alert('Acceso denegado: no tienes permisos de administrador.');
        return;
    }

    const verified = await verifySession(currentUser.token);
    if (!verified || verified.type !== 'admin') {
        alert('Sesión administrativa inválida o expirada. Inicia sesión de nuevo.');
        handleLogout();
        return;
    }

    currentUser.isAdmin = true;
    currentUser.name = verified.usuario;
    currentUser.role = verified.cargo;
    store.set(KEYS.session, sanitizeSessionUser(currentUser));

    const panel = document.getElementById('admin-panel');
    if (!panel) { console.error(`${DEBUG_PREFIX} No se encontró #admin-panel`); return; }

    const isHidden = panel.classList.contains('hidden');

    if (isHidden) {
        // Ocultar la vista pública para evitar conflictos
        document.getElementById('public-view')?.classList.add('hidden');
        panel.classList.remove('hidden');
        // Usar setTimeout para garantizar que el DOM esté pintado antes de poblar
        setTimeout(() => renderAdminPanel(), 0);
    } else {
        panel.classList.add('hidden');
        document.getElementById('public-view')?.classList.remove('hidden');
        switchMainView('biblioteca');
    }
}

/* ============================================================
   ADMIN DASHBOARD TABS
   ============================================================ */
function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });
}

/* ============================================================
   ACORDEONES (AETSRO / CONSEJO)
   ============================================================ */
function toggleAccordion(id) {
    const content = document.getElementById(id);
    if (content) content.classList.toggle('hidden');
}

/* ============================================================
   RENDERIZADO DEL PANEL ADMIN
   ============================================================ */
async function renderAdminPanel() {
    const docs  = store.get(KEYS.docs)  || [];
    const anns  = _cachedAnns.length > 0 ? _cachedAnns : (store.get(KEYS.anns) || []);
    let users   = [];

    try {
        users = await fetchStudents();
    } catch (err) {
        console.error(`${DEBUG_PREFIX} Error cargando estudiantes:`, err);
    }

    const statStudents  = document.getElementById('stat-students');
    const statDocs      = document.getElementById('stat-docs');

    if (statStudents)  statStudents.textContent  = users.length;
    if (statDocs)      statDocs.textContent       = docs.length;

    renderAdminMessagesList();
    renderAdminStudentsList(users);
    renderAdminCleanupSection(docs, anns);
}

function renderAdminMessagesList() {
    const msgs      = store.get(KEYS.msgs) || [];
    const container = document.getElementById('admin-messages-list');
    if (!container) return;
    if (!msgs.length) { container.innerHTML = '<p>No hay mensajes.</p>'; return; }
    container.innerHTML = msgs.map(m => `
        <div class="message-card">
            <div><strong>${m.studentName}</strong> (${m.studentCarne})</div>
            <div>${m.content}</div>
            <div style="font-size:0.8rem;color:var(--gray-600);margin-top:0.5rem;">${new Date(m.timestamp).toLocaleString()}</div>
            ${m.reply ? `<div style="margin-top:0.5rem;padding:0.5rem;background:var(--gray-200);border-radius:4px;"><strong>Respuesta:</strong> ${m.reply}</div>` : ''}
            <form onsubmit="replyMsg(event,${m.id})" style="margin-top:0.5rem;display:flex;gap:0.5rem;">
                <input type="text" placeholder="Responder..." class="premium-input" required style="flex:1;">
                <button type="submit" class="btn-small">Enviar</button>
            </form>
            <button onclick="deleteMsg(${m.id})" class="btn-small" style="margin-top:0.5rem;">Eliminar</button>
        </div>`
    ).join('');
}

function renderAdminStudentsList(users) {
    const container = document.getElementById('admin-students-list');
    if (!container) return;
    if (!users.length) { container.innerHTML = '<p>No hay estudiantes registrados.</p>'; return; }
    container.innerHTML = users.map(u =>
        `<div class="message-card">
            <strong>${u.name}</strong> — Carné: ${u.carne}
            <button type="button" class="btn-small mute-student-btn" data-carne="${u.carne}" data-muted="${u.muted}" style="margin-left:1rem;">${u.muted ? 'Desilenciar' : 'Silenciar'}</button>
        </div>`
    ).join('');
}

function renderAdminCleanupSection(docs, anns) {
    const container = document.getElementById('admin-cleanup-section');
    if (!container) return;
    let html = '<h4>Documentos</h4>';
    html += docs.length
        ? docs.map(d => `<div class="message-card">${d.title} — <em>${d.type}</em>
            <button onclick="deleteDoc(${d.id})" class="btn-small" style="margin-left:0.5rem;">Eliminar</button>
            <button onclick="togglePinDoc(${d.id})" class="btn-small">${d.pinned ? 'Desfijar' : 'Fijar'}</button>
          </div>`).join('')
        : '<p>Sin documentos.</p>';
    html += '<h4 style="margin-top:1rem;">Avisos</h4>';
    html += anns.length
        ? anns.map(a => `<div class="message-card">${a.title}
            <button onclick="deleteAnn(${a.id})" class="btn-small" style="margin-left:0.5rem;">Eliminar</button>
            <button onclick="togglePinAnn(${a.id})" class="btn-small">${a.pinned ? 'Desfijar' : 'Fijar'}</button>
          </div>`).join('')
        : '<p>Sin avisos.</p>';
    container.innerHTML = html;
}

/* ============================================================
   ACCIONES DE ADMINISTRACIÓN
   ============================================================ */
function adminAddDoc(e) {
    e.preventDefault();
    const docs = store.get(KEYS.docs) || [];
    docs.push({
        id: Date.now(),
        type: document.getElementById('doc-type').value,
        title: document.getElementById('doc-title').value.trim(),
        author: document.getElementById('doc-author').value.trim(),
        link: document.getElementById('doc-link').value.trim(),
        pinned: false, createdAt: new Date().toISOString()
    });
    store.set(KEYS.docs, docs);
    e.target.reset();
    alert('Recurso publicado');
    renderAdminPanel();
}

function adminAddAnn(e) {
    e.preventDefault();
    const fileInput = document.getElementById('ann-image');
    const title = document.getElementById('ann-title').value.trim();
    const content = document.getElementById('ann-content').value.trim();
    const type = document.getElementById('ann-type').value;
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    const postAnnouncement = async (base64Image = null) => {
        if (submitBtn) submitBtn.disabled = true;
        try {
            const response = await fetch('/api/announcements', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ title, content, type, image: base64Image })
            });
            const data = await response.json();
            if (!data.success) {
                alert(data.message || 'Error publicando aviso');
                return;
            }
            form.reset();
            alert('Aviso publicado y visible para todos los estudiantes');
            await fetchAndRenderAnnouncements();
            renderAdminPanel();
        } catch (err) {
            console.error(`${DEBUG_PREFIX} Error publicando anuncio:`, err);
            alert('Error de conexión al publicar el aviso');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    };

    if (fileInput && fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => postAnnouncement(event.target.result);
        reader.onerror = () => alert('Error al procesar la imagen');
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        postAnnouncement();
    }
}

function deleteDoc(id)  { if (!confirm('¿Eliminar?')) return; store.set(KEYS.docs,  (store.get(KEYS.docs)  || []).filter(d => d.id !== id)); renderAdminPanel(); renderAll(); }
async function deleteAnn(id) {
    if (!confirm('¿Eliminar aviso?')) return;
    try {
        const response = await fetch('/api/announcements', {
            method: 'DELETE',
            headers: authHeaders(),
            body: JSON.stringify({ id })
        });
        const data = await response.json();
        if (!data.success) { alert(data.message || 'Error eliminando'); return; }
        await fetchAndRenderAnnouncements();
        renderAdminPanel();
    } catch (err) {
        console.error(`${DEBUG_PREFIX} Error eliminando anuncio:`, err);
    }
}
function deleteMsg(id)  { if (!confirm('¿Eliminar?')) return; store.set(KEYS.msgs,  (store.get(KEYS.msgs)  || []).filter(m => m.id !== id)); renderAdminPanel(); }

async function muteStudent(carne, currentlyMuted) {
    try {
        const response = await fetch('/api/students', {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ carne, muted: !currentlyMuted })
        });
        const data = await response.json();
        if (!data.success) {
            alert(data.message || 'No se pudo actualizar al estudiante');
            return;
        }
        await renderAdminPanel();
        alert(`Estudiante ${!currentlyMuted ? 'silenciado' : 'desilenciado'}`);
    } catch (err) {
        console.error(`${DEBUG_PREFIX} Error silenciando estudiante:`, err);
        alert('Error de conexión al actualizar estudiante');
    }
}
function replyMsg(e, id) {
    e.preventDefault();
    const reply = e.target.querySelector('input').value.trim();
    const msgs  = store.get(KEYS.msgs) || [];
    const msg   = msgs.find(m => m.id === id);
    if (msg) { msg.reply = reply; store.set(KEYS.msgs, msgs); renderAdminPanel(); alert('Respuesta enviada'); }
}
function togglePinDoc(id) { const docs = store.get(KEYS.docs) || []; const d = docs.find(d => d.id === id); if (d) { d.pinned = !d.pinned; store.set(KEYS.docs, docs); renderAdminPanel(); renderAll(); } }
async function togglePinAnn(id) {
    const ann = _cachedAnns.find(a => a.id === id);
    if (!ann) return;
    try {
        const response = await fetch('/api/announcements', {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ id, pinned: !ann.pinned })
        });
        const data = await response.json();
        if (!data.success) { alert(data.message || 'Error actualizando'); return; }
        await fetchAndRenderAnnouncements();
        renderAdminPanel();
    } catch (err) {
        console.error(`${DEBUG_PREFIX} Error fijando anuncio:`, err);
    }
}

/* ============================================================
   ACCIONES DE ESTUDIANTE
   ============================================================ */
function studentAddDoc(e) {
    e.preventDefault();
    if (studentSessionDocs >= 1) { alert('Límite de 1 documento por sesión'); return; }
    const docs = store.get(KEYS.docs) || [];
    docs.push({
        id: Date.now(),
        type: document.getElementById('student-doc-type').value,
        title: document.getElementById('student-doc-title').value.trim(),
        author: currentUser.name,
        link: document.getElementById('student-doc-link').value.trim(),
        pinned: false, isStudentContribution: true, createdAt: new Date().toISOString()
    });
    store.set(KEYS.docs, docs);
    studentSessionDocs++;
    e.target.reset();
    alert('Documento publicado');
    renderAll();
}

function studentAddAnn(e) {
    e.preventDefault();
    if (studentSessionAnns >= 1) { alert('Límite de 1 aviso por sesión'); return; }
    const anns = store.get(KEYS.anns) || [];
    anns.unshift({
        id: Date.now(),
        title: document.getElementById('student-ann-title').value.trim(),
        content: document.getElementById('student-ann-content').value.trim(),
        type: 'general', pinned: false, isStudentContribution: true,
        studentName: currentUser.name, createdAt: new Date().toISOString()
    });
    store.set(KEYS.anns, anns);
    studentSessionAnns++;
    e.target.reset();
    alert('Aviso publicado');
    renderAll();
}

function studentSendMsg(e) {
    e.preventDefault();
    const msgs = store.get(KEYS.msgs) || [];
    msgs.push({
        id: Date.now(),
        studentId: currentUser.id,
        studentName: currentUser.name,
        studentCarne: currentUser.carne,
        content: document.getElementById('msg-content').value.trim(),
        reply: null,
        timestamp: new Date().toISOString()
    });
    store.set(KEYS.msgs, msgs);
    e.target.reset();
    alert('Mensaje enviado');
    renderMyMessages();
}

function renderMyMessages() {
    if (!currentUser || currentUser.isAdmin) return;
    const msgs      = (store.get(KEYS.msgs) || []).filter(m => m.studentId === currentUser.id);
    const container = document.getElementById('messages-list');
    if (!container) return;
    if (!msgs.length) { container.innerHTML = '<p>No has enviado mensajes</p>'; return; }
    container.innerHTML = msgs.map(m =>
        `<div class="message-card">
            <div>${m.content}</div>
            <div style="font-size:0.8rem;color:var(--gray-600);margin-top:0.5rem;">${new Date(m.timestamp).toLocaleString()}</div>
            ${m.reply ? `<div style="margin-top:0.5rem;padding:0.5rem;background:var(--usac-blue);color:white;border-radius:4px;"><strong>Respuesta:</strong> ${m.reply}</div>` : ''}
        </div>`
    ).join('');
}

/* ============================================================
   RENDERIZADO PÚBLICO
   ============================================================ */
function linkify(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

let currentGalleryImages = [];
let currentImageIndex = 0;

function openLightbox(src, alt, galleryContainer = null) {
    const lb = document.getElementById('img-lightbox');
    const lbImg = document.getElementById('img-lightbox-img');
    if (!lb || !lbImg) return;
    
    // Detectar si la imagen viene de una galería y capturar todas las imágenes
    if (galleryContainer) {
        const images = galleryContainer.querySelectorAll('img');
        currentGalleryImages = Array.from(images).map(img => ({
            src: img.currentSrc || img.src,
            alt: img.alt || ''
        }));
        currentImageIndex = currentGalleryImages.findIndex(img => img.src === src);
    } else {
        currentGalleryImages = [{src, alt}];
        currentImageIndex = 0;
    }
    
    lbImg.src = src;
    lbImg.alt = alt || '';
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    lb.focus();
}

function nextGalleryImage() {
    if (currentGalleryImages.length <= 1) return;
    currentImageIndex = (currentImageIndex + 1) % currentGalleryImages.length;
    displayGalleryImage();
}

function prevGalleryImage() {
    if (currentGalleryImages.length <= 1) return;
    currentImageIndex = (currentImageIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
    displayGalleryImage();
}

function displayGalleryImage() {
    const lbImg = document.getElementById('img-lightbox-img');
    const counter = document.getElementById('img-lightbox-counter');
    const prevBtn = document.getElementById('img-lightbox-prev');
    const nextBtn = document.getElementById('img-lightbox-next');
    
    if (!lbImg || !currentGalleryImages[currentImageIndex]) return;
    lbImg.src = currentGalleryImages[currentImageIndex].src;
    lbImg.alt = currentGalleryImages[currentImageIndex].alt;
    
    // Mostrar u ocultar botones según la cantidad de imágenes
    const hasMultipleImages = currentGalleryImages.length > 1;
    if (prevBtn) prevBtn.style.display = hasMultipleImages ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = hasMultipleImages ? 'flex' : 'none';
    
    // Actualizar contador
    if (counter && hasMultipleImages) {
        counter.textContent = `${currentImageIndex + 1} / ${currentGalleryImages.length}`;
        counter.style.display = 'block';
    } else if (counter) {
        counter.style.display = 'none';
    }
}

function applyImageInteractivity(root = document) {
    const images = root.querySelectorAll('img:not(#img-lightbox-img)');
    images.forEach(img => {
        if (img.closest('#img-lightbox')) return;
        if (img.classList.contains('interactive-image')) return;
        // Excluir imágenes de navegación y logotipos del encabezado
        if (img.classList.contains('nav-logo') || img.classList.contains('header-logo')) return;
        if (img.classList.contains('hero-gif')) return;
        // Excluir imágenes en las secciones de cursos e IA
        if (img.closest('#tab-cursos') || img.closest('#tab-ia')) return;

        img.classList.add('interactive-image');
        img.setAttribute('tabindex', '0');
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', img.alt || 'Abrir imagen ampliada');

        if (!img.getAttribute('title')) {
            img.setAttribute('title', 'Clic para ver imagen completa');
        }
    });
}

function openImageFromElement(img) {
    if (!img) return;
    const source = img.currentSrc || img.src;
    if (!source) return;
    
    // Buscar si la imagen está en una galería (consejo-gallery-grid, image-gallery, pdf-list-container, etc.)
    let galleryContainer = img.closest('.consejo-gallery-grid') || 
                           img.closest('.image-gallery') || 
                           img.closest('.pdf-list-container');
    
    openLightbox(source, img.alt || '', galleryContainer);
}

function closeLightbox() {
    const lb = document.getElementById('img-lightbox');
    if (!lb) return;
    lb.classList.remove('open');
    document.body.style.overflow = '';
    const lbImg = document.getElementById('img-lightbox-img');
    if (lbImg) lbImg.src = '';
    currentGalleryImages = [];
    currentImageIndex = 0;
}

function renderAll() { fetchAndRenderAnnouncements(); renderRepositorio(); renderMyMessages(); }

// Caché en memoria de los anuncios cargados desde la API
let _cachedAnns = [];

async function fetchAndRenderAnnouncements(search = '') {
    const container = document.getElementById('announcements-list');
    if (!container) return;

    // Mostrar skeleton mientras carga
    container.innerHTML = '<p style="color:var(--gray-500);padding:1rem;">Cargando noticias...</p>';

    try {
        const response = await fetch('/api/announcements', { headers: authHeaders(false) });
        const data = await response.json();
        if (data.success) {
            _cachedAnns = data.announcements || [];
        }
    } catch (err) {
        console.warn(`${DEBUG_PREFIX} Sin conexión, usando caché local de anuncios.`, err);
    }

    renderAnnouncements(search);
}

function renderAnnouncements(search = '') {
    let anns = _cachedAnns.slice(); // copia del caché en memoria
    anns.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    if (search) { const s = search.toLowerCase(); anns = anns.filter(a => a.title.toLowerCase().includes(s) || a.content.toLowerCase().includes(s)); }
    const container = document.getElementById('announcements-list');
    if (!container) return;
    if (!anns.length) { container.innerHTML = '<p>No hay anuncios publicados aún.</p>'; return; }
    container.innerHTML = anns.map(a =>
        `<div class="announcement-card ${a.type === 'urgente' ? 'urgent' : ''}">
            ${a.image ? `<img src="${a.image}" alt="Imagen: ${a.title}" class="ann-card-img" title="Clic para ver imagen completa">` : ''}
            <div class="ann-body">
                <h3>${a.pinned ? '📌 ' : ''}${a.title}</h3>
                <p>${linkify(a.content)}</p>
                ${a.isStudentContribution ? `<div class="ann-meta">Por: ${a.studentName}</div>` : ''}
                <div class="ann-meta">${new Date(a.createdAt).toLocaleDateString()}</div>
            </div>
        </div>`
    ).join('');
    applyImageInteractivity(container);
}

function renderRepositorio(search = '', filter = 'all') {
    let docs = store.get(KEYS.docs) || [];
    if (filter !== 'all') docs = docs.filter(d => d.type === filter);
    if (search) { const s = search.toLowerCase(); docs = docs.filter(d => d.title.toLowerCase().includes(s) || d.author.toLowerCase().includes(s)); }
    docs.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const container = document.getElementById('repositorio-list');
    if (!container) return;
    if (!docs.length) { container.innerHTML = '<p>No hay documentos</p>'; return; }
    container.innerHTML = docs.map(d =>
        `<div class="doc-card">
            <h3>${d.pinned ? '📌 ' : ''}${d.title}</h3>
            <div class="doc-meta">Autor: ${d.author} | Tipo: ${d.type.toUpperCase()}</div>
            <a href="${d.link}" target="_blank" class="btn-blue" style="display:inline-block;margin-top:0.5rem;text-decoration:none;">Ver Documento →</a>
        </div>`
    ).join('');
}

/* ============================================================
   EVENT LISTENERS E INICIALIZACIÓN
   ============================================================ */
function toggleMobileNav() {
    const header = document.getElementById('app-header');
    const btn = document.getElementById('btn-mobile-menu');
    if (!header || !btn) return;
    const open = header.classList.toggle('nav-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? '✕' : '☰';
}

function closeMobileNav() {
    const header = document.getElementById('app-header');
    const btn = document.getElementById('btn-mobile-menu');
    if (header) header.classList.remove('nav-open');
    if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.textContent = '☰'; }
}

function setupEventListeners() {
    document.getElementById('btn-enter')?.addEventListener('click', showAuthModal);
    document.getElementById('login-form')?.addEventListener('submit', handleAuth);
    document.getElementById('register-form')?.addEventListener('submit', handleAuth);
    // Admin form: listener asíncrono
    document.getElementById('admin-form')?.addEventListener('submit', (e) => handleAdminAccess(e));

    document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn =>
        btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab))
    );

    document.getElementById('btn-mobile-menu')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileNav();
    });

    document.getElementById('admin-students-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.mute-student-btn');
        if (!btn) return;
        muteStudent(btn.dataset.carne, btn.dataset.muted === 'true');
    });

    document.getElementById('admin-doc-form')?.addEventListener('submit', adminAddDoc);
    document.getElementById('admin-ann-form')?.addEventListener('submit', adminAddAnn);
    document.getElementById('student-doc-form')?.addEventListener('submit', studentAddDoc);
    document.getElementById('student-ann-form')?.addEventListener('submit', studentAddAnn);
    document.getElementById('student-msg-form')?.addEventListener('submit', studentSendMsg);

    document.getElementById('global-search')?.addEventListener('input', (e) => {
        renderAnnouncements(e.target.value);
        renderRepositorio(e.target.value, currentFilter);
    });

    document.querySelectorAll('.filter-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderRepositorio(document.getElementById('global-search')?.value || '', currentFilter);
        })
    );

    // Cerrar modales al hacer clic en el backdrop
    document.querySelectorAll('.modal-backdrop').forEach(modal =>
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
        })
    );

    // Lightbox: cerrar al hacer clic en el fondo oscuro
    document.getElementById('img-lightbox')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('img-lightbox')) closeLightbox();
    });

    document.addEventListener('click', (e) => {
        const img = e.target.closest('img.interactive-image');
        if (!img || img.closest('#img-lightbox')) return;
        e.preventDefault();
        openImageFromElement(img);
    });

    // Lightbox: cerrar con tecla Escape y navegación con flechas
    document.addEventListener('keydown', (e) => {
        const lb = document.getElementById('img-lightbox');
        if (!lb || !lb.classList.contains('open')) return;
        
        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            nextGalleryImage();
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            prevGalleryImage();
        } else if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.matches('img.interactive-image')) {
            e.preventDefault();
            openImageFromElement(document.activeElement);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('open'));
        }
    });

    // Soporte para click/touch en botones dropdown
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        const btn = dropdown.querySelector('.dropbtn');
        const content = dropdown.querySelector('.dropdown-content');
        if (btn && content) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Cerrar otros dropdowns
                document.querySelectorAll('.dropdown-content').forEach(d => {
                    if (d !== content) d.classList.remove('open');
                });
                content.classList.toggle('open');
            });
            content.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    content.classList.remove('open');
                    closeMobileNav();
                });
            });
        }
    });
}


/* ============================================================
   REDES SOCIALES – ORDEN 5
   Persiste URLs en localStorage y renderiza íconos en el footer.
   ============================================================ */

const SOCIAL_NETWORKS = [
    { key: 'facebook',  icon: 'fa-facebook-f',   label: 'Facebook',  cls: 'facebook-ico'  },
    { key: 'x',         icon: 'fa-x-twitter',     label: 'X',         cls: 'x-ico'         },
    { key: 'instagram', icon: 'fa-instagram',      label: 'Instagram', cls: 'instagram-ico' },
    { key: 'linkedin',  icon: 'fa-linkedin-in',    label: 'LinkedIn',  cls: 'linkedin-ico'  },
    { key: 'youtube',   icon: 'fa-youtube',        label: 'YouTube',   cls: 'youtube-ico'   },
    { key: 'whatsapp',  icon: 'fa-whatsapp',       label: 'WhatsApp',  cls: 'whatsapp-ico'  }
];

function renderSocialLinks() {
    const container = document.getElementById('footer-social-icons');
    if (!container) return;

    const saved = store.get(KEYS.social) || {};
    container.innerHTML = '';

    SOCIAL_NETWORKS.forEach(net => {
        const url = saved[net.key] || '';
        if (!url) return;

        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = `social-icon-link ${net.cls}`;
        a.title = net.label;
        a.setAttribute('aria-label', net.label);
        a.innerHTML = `<i class="fab ${net.icon}"></i>`;
        container.appendChild(a);
    });
}

function loadSocialFormValues() {
    const saved = store.get(KEYS.social) || {};
    SOCIAL_NETWORKS.forEach(net => {
        const input = document.getElementById(`social-${net.key}`);
        if (input) input.value = saved[net.key] || '';
    });
}

function setupSocialForm() {
    const form = document.getElementById('admin-social-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {};
        SOCIAL_NETWORKS.forEach(net => {
            const input = document.getElementById(`social-${net.key}`);
            data[net.key] = input ? input.value.trim() : '';
        });
        store.set(KEYS.social, data);
        renderSocialLinks();

        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> ¡Guardado!';
            btn.style.background = '#22c55e';
            setTimeout(() => {
                btn.innerHTML = original;
                btn.style.background = '';
            }, 2000);
        }
    });
}

window.addEventListener('DOMContentLoaded', async () => {
    applyStoredTheme();
    applyImageInteractivity(document);
    setupEventListeners();
    setupSocialForm();
    renderSocialLinks();
    loadSocialFormValues();

    const session = store.get(KEYS.session);
    if (session?.token) {
        const verified = await verifySession(session.token);
        if (verified?.type === 'admin') {
            loginSuccess(sanitizeSessionUser({
                ...session,
                isAdmin: true,
                name: verified.usuario,
                role: verified.cargo,
                token: session.token
            }));
        } else if (verified?.type === 'student') {
            loginSuccess(sanitizeSessionUser({
                id: verified.id,
                name: verified.name,
                carne: verified.carne,
                role: verified.role,
                muted: verified.muted,
                token: session.token
            }));
        } else {
            localStorage.removeItem(KEYS.session);
        }
    }

    studentSessionDocs = 0;
    studentSessionAnns = 0;
});

/* ============================================================
   TARJETAS LEGALES — TOGGLE PARA MÓVIL / TECLADO
   ============================================================ */
function toggleLegalCard(card) {
    const isExpanded = card.classList.contains('expanded');
    // Cerrar todas las demás tarjetas legales
    document.querySelectorAll('.legal-card').forEach(c => c.classList.remove('expanded'));
    // Alternar la actual
    if (!isExpanded) {
        card.classList.add('expanded');
        card.setAttribute('aria-expanded', 'true');
        const full = card.querySelector('.legal-full');
        if (full) full.setAttribute('aria-hidden', 'false');
    } else {
        card.setAttribute('aria-expanded', 'false');
        const full = card.querySelector('.legal-full');
        if (full) full.setAttribute('aria-hidden', 'true');
    }
}

// Soporte teclado: Enter / Space expanden la tarjeta
document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('legal-card')) {
        e.preventDefault();
        toggleLegalCard(e.target);
    }
});

/* ==== Guided Header Tour Functions ==== */
function startHeaderTour() {
    if (localStorage.getItem('headerTourCompleted')) return;
    const header = document.getElementById('app-header');
    if (!header) return;
    const buttons = header.querySelectorAll('button');
    buttons.forEach(btn => createTooltipForButton(btn));
    // Close all tooltips when clicking outside
    document.addEventListener('click', function handler(e) {
        if (!e.target.closest('.tour-tooltip') && !e.target.closest('button')) {
            removeAllTooltips();
            document.removeEventListener('click', handler);
        }
    });
}

function createTooltipForButton(btn) {
    // Ensure the button has a unique ID for triggering
    if (!btn.id) {
        btn.id = 'tour-btn-' + Math.random().toString(36).substr(2, 9);
    }
    const rect = btn.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    tooltip.style.top = `${rect.top + window.scrollY - 10}px`;
    tooltip.style.left = `${rect.left + window.scrollX + rect.width + 8}px`;
    const label = btn.getAttribute('title') || btn.getAttribute('aria-label') || btn.innerText || 'Botón';
    tooltip.innerHTML = `<strong>${label}</strong><br/><button onclick="triggerButton('${btn.id}')">Ir</button>`;
    document.body.appendChild(tooltip);
}

function triggerButton(btnId) {
    const btn = document.getElementById(btnId);
    if (btn) btn.click();
    removeAllTooltips();
}

function removeAllTooltips() {
    document.querySelectorAll('.tour-tooltip').forEach(t => t.remove());
    localStorage.setItem('headerTourCompleted', 'true');
}
/* ==== End Guided Header Tour Functions ==== */

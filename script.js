/* ============================================================
   Biblioteca Digital CUNOC – Trabajo Social
   script.js – Refactorizado con hashing SHA-256 y panel admin corregido
   ============================================================ */

const DEBUG_PREFIX = '[CUNOC]';
const KEYS = {
    users:   'biblioteca_users_v3',
    docs:    'biblioteca_docs_v3',
    anns:    'biblioteca_anns_v3',
    session: 'biblioteca_session_v3',
    msgs:    'biblioteca_msgs_v3',
    social:  'biblioteca_social_v1'
};

/* ============================================================
   SEGURIDAD: Autenticación Administrativa delegada al Backend
   (Las contraseñas y hashes residen exclusivamente en el servidor)
   ============================================================ */

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

// Inicializar datos por defecto
if (!store.get(KEYS.users))  store.set(KEYS.users, []);
if (!store.get(KEYS.docs))   store.set(KEYS.docs, []);
if (!store.get(KEYS.anns))   store.set(KEYS.anns, []);
if (!store.get(KEYS.msgs))   store.set(KEYS.msgs, []);

let currentUser        = null;
let calendarView       = 'month';
let currentFilter      = 'all';
let studentSessionDocs = 0;
let studentSessionAnns = 0;

/* ============================================================
   NAVEGACIÓN ENTRE VISTAS INSTITUCIONALES
   ============================================================ */
function switchMainView(viewName) {
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
    } else if (viewName === 'consejo') {
        restartConsejoGif();
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
        renderCalendar();
    }
}

/* ============================================================
   AUTENTICACIÓN DE ESTUDIANTES (sin cambios)
   ============================================================ */
function handleAuth(e) {
    e.preventDefault();
    const isLogin = !document.getElementById('login-form').classList.contains('hidden');
    if (isLogin) {
        const carne    = document.getElementById('login-carne').value.trim();
        const password = document.getElementById('login-password').value;
        const users    = store.get(KEYS.users) || [];
        const user     = users.find(u => u.carne === carne && u.password === password);
        if (user) {
            if (user.muted) { alert('Tu cuenta ha sido silenciada. Contacta al administrador.'); return; }
            loginSuccess(user);
        } else {
            alert('Carné o contraseña incorrectos');
        }
    } else {
        const name     = document.getElementById('reg-name').value.trim();
        const carne    = document.getElementById('reg-carne').value.trim();
        const password = document.getElementById('reg-password').value;
        const users    = store.get(KEYS.users) || [];
        if (users.find(u => u.carne === carne)) { alert('Este carné ya está registrado'); return; }
        const newUser = { id: Date.now(), name, carne, password, role: 'student', muted: false, registeredAt: new Date().toISOString() };
        users.push(newUser);
        store.set(KEYS.users, users);
        alert('Registro exitoso. Entrando a la biblioteca.');
        loginSuccess(newUser);
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
            const adminUser = { 
                id: Date.now(), 
                name: data.usuario, 
                role: data.cargo, 
                isAdmin: true,
                token: data.token
            };
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
    currentUser = user;
    store.set(KEYS.session, user);

    document.getElementById('welcome-screen')?.classList.add('hidden');
    document.getElementById('auth-modal')?.classList.add('hidden');
    document.getElementById('app-header')?.classList.remove('hidden');
    document.getElementById('public-view')?.classList.remove('hidden');
    document.getElementById('app-footer')?.classList.remove('hidden');
    document.getElementById('admin-panel')?.classList.add('hidden');

    updateHeaderUI();
    switchMainView('biblioteca');
    renderAll();
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
    if (adminPanelBtn) adminPanelBtn.classList.toggle('hidden', !currentUser.isAdmin);
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) welcomeMsg.textContent = `Bienvenido, ${currentUser.name}`;
}

function restartHeroGif() {
    const heroGif = document.getElementById('hero-gif-bg');
    if (!heroGif) return;

    if (heroGif.gifTimeout) {
        clearTimeout(heroGif.gifTimeout);
    }

    // Evitar almacenamiento en caché para forzar el reinicio de la animación del GIF
    heroGif.src = 'imags/usac1_hd.gif?t=' + Date.now();

    heroGif.gifTimeout = setTimeout(() => {
        heroGif.src = 'imags/usac1_hd_static.png';
    }, 7680); // Duración exacta de la animación: 7.68 segundos
}

function restartAetsroGif() {
    const aetsroGif = document.getElementById('aetsro-gif-bg');
    if (!aetsroGif) return;

    if (aetsroGif.gifTimeout) {
        clearTimeout(aetsroGif.gifTimeout);
    }

    // Evitar almacenamiento en caché para forzar el reinicio de la animación del GIF
    aetsroGif.src = 'imags/aetsro_hd.gif?t=' + Date.now();

    aetsroGif.gifTimeout = setTimeout(() => {
        aetsroGif.src = 'imags/aetsro_hd_static.png';
    }, 7680); // Duración exacta de la animación: 7.68 segundos
}

function restartConsejoGif() {
    const consejoGif = document.getElementById('consejo-gif-bg');
    if (!consejoGif) return;

    if (consejoGif.gifTimeout) {
        clearTimeout(consejoGif.gifTimeout);
    }

    // Evitar caché para reiniciar la animación del GIF
    consejoGif.src = 'imags/huelga.gif?t=' + Date.now();

    consejoGif.gifTimeout = setTimeout(() => {
        consejoGif.src = 'imags/huelga.gif';
    }, 7680); // Duración 7.68 s
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
function toggleAdminPanel() {
    // Solo permitir si el usuario es admin
    if (!currentUser || !currentUser.isAdmin) {
        alert('Acceso denegado: no tienes permisos de administrador.');
        return;
    }

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
   ACORDEONES (AETSRO / CONSEJO)
   ============================================================ */
function toggleAccordion(id) {
    const content = document.getElementById(id);
    if (content) content.classList.toggle('hidden');
}

/* ============================================================
   RENDERIZADO DEL PANEL ADMIN
   ============================================================ */
function renderAdminPanel() {
    const users = store.get(KEYS.users) || [];
    const docs  = store.get(KEYS.docs)  || [];
    const anns  = store.get(KEYS.anns)  || [];

    const statStudents  = document.getElementById('stat-students');
    const statDocs      = document.getElementById('stat-docs');
    const statDownloads = document.getElementById('stat-downloads');

    if (statStudents)  statStudents.textContent  = users.length;
    if (statDocs)      statDocs.textContent       = docs.length;
    if (statDownloads) statDownloads.textContent  = '0';

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
            <button onclick="muteStudent('${u.carne}')" class="btn-small" style="margin-left:1rem;">${u.muted ? 'Desilenciar' : 'Silenciar'}</button>
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

    const saveAnnouncement = (base64Image = null) => {
        const anns = store.get(KEYS.anns) || [];
        anns.unshift({
            id: Date.now(),
            title,
            content,
            type,
            image: base64Image,
            pinned: false,
            createdAt: new Date().toISOString()
        });
        store.set(KEYS.anns, anns);
        form.reset();
        alert('Aviso publicado');
        renderAdminPanel();
        renderAll();
    };

    if (fileInput && fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) {
            saveAnnouncement(event.target.result);
        };
        reader.onerror = function() {
            alert('Error al procesar la imagen');
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        saveAnnouncement();
    }
}

function deleteDoc(id)  { if (!confirm('¿Eliminar?')) return; store.set(KEYS.docs,  (store.get(KEYS.docs)  || []).filter(d => d.id !== id)); renderAdminPanel(); renderAll(); }
function deleteAnn(id)  { if (!confirm('¿Eliminar?')) return; store.set(KEYS.anns,  (store.get(KEYS.anns)  || []).filter(a => a.id !== id)); renderAdminPanel(); renderAll(); }
function deleteMsg(id)  { if (!confirm('¿Eliminar?')) return; store.set(KEYS.msgs,  (store.get(KEYS.msgs)  || []).filter(m => m.id !== id)); renderAdminPanel(); }

function muteStudent(carne) {
    const users = store.get(KEYS.users) || [];
    const user  = users.find(u => u.carne === carne);
    if (user) { user.muted = !user.muted; store.set(KEYS.users, users); renderAdminPanel(); alert(`Estudiante ${user.muted ? 'silenciado' : 'desilenciado'}`); }
}
function replyMsg(e, id) {
    e.preventDefault();
    const reply = e.target.querySelector('input').value.trim();
    const msgs  = store.get(KEYS.msgs) || [];
    const msg   = msgs.find(m => m.id === id);
    if (msg) { msg.reply = reply; store.set(KEYS.msgs, msgs); renderAdminPanel(); alert('Respuesta enviada'); }
}
function togglePinDoc(id) { const docs = store.get(KEYS.docs) || []; const d = docs.find(d => d.id === id); if (d) { d.pinned = !d.pinned; store.set(KEYS.docs, docs); renderAdminPanel(); renderAll(); } }
function togglePinAnn(id) { const anns = store.get(KEYS.anns) || []; const a = anns.find(a => a.id === id); if (a) { a.pinned = !a.pinned; store.set(KEYS.anns, anns); renderAdminPanel(); renderAll(); } }

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
function renderAll() { renderAnnouncements(); renderRepositorio(); renderMyMessages(); }

function renderAnnouncements(search = '') {
    let anns = store.get(KEYS.anns) || [];
    anns.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    if (search) { const s = search.toLowerCase(); anns = anns.filter(a => a.title.toLowerCase().includes(s) || a.content.toLowerCase().includes(s)); }
    const container = document.getElementById('announcements-list');
    if (!container) return;
    if (!anns.length) { container.innerHTML = '<p>No hay anuncios</p>'; return; }
    container.innerHTML = anns.map(a =>
        `<div class="announcement-card ${a.type === 'urgente' ? 'urgent' : ''}">
            <h3>${a.pinned ? '📌 ' : ''}${a.title}</h3>
            <p>${a.content}</p>
            ${a.image ? `<img src="${a.image}" alt="Imagen de aviso: ${a.title}" class="ann-card-img" style="max-width:100%; max-height:300px; object-fit:cover; border-radius:var(--radius-sm); margin-top:0.75rem; display:block;">` : ''}
            ${a.isStudentContribution ? `<div style="font-size:0.8rem;color:var(--gray-600);margin-top:0.5rem;">Por: ${a.studentName}</div>` : ''}
            <div style="font-size:0.8rem;color:var(--gray-600);margin-top:0.5rem;">${new Date(a.createdAt).toLocaleDateString()}</div>
        </div>`
    ).join('');
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
   CALENDARIO
   ============================================================ */
function renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    const now = new Date();
    if (calendarView === 'month')      renderMonthView(container, now.getFullYear(), now.getMonth());
    else if (calendarView === 'week')  renderWeekView(container, now);
    else                               renderDayView(container, now);
}

function renderMonthView(container, year, month) {
    const firstDay     = new Date(year, month, 1);
    const lastDay      = new Date(year, month + 1, 0);
    const daysInMonth  = lastDay.getDate();
    const startingDay  = firstDay.getDay();
    const monthNames   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    let html = `<h3 style="text-align:center;margin-bottom:1rem;color:var(--usac-blue);">${monthNames[month]} ${year}</h3>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.5rem;">`;
    ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].forEach(d => html += `<div style="text-align:center;font-weight:bold;padding:0.5rem;">${d}</div>`);
    for (let i = 0; i < startingDay; i++) html += '<div></div>';
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        html += `<div style="text-align:center;padding:0.75rem;background:${isToday ? 'var(--usac-blue)' : 'var(--gray-200)'};color:${isToday ? 'white' : 'inherit'};border-radius:4px;cursor:pointer;">${day}</div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

function renderWeekView(container, date) {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    let html = '<h3 style="text-align:center;margin-bottom:1rem;color:var(--usac-blue);">Semana Actual</h3><div style="display:grid;gap:0.5rem;">';
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        html += `<div style="padding:1rem;background:var(--gray-200);border-radius:4px;"><strong>${d.toLocaleDateString('es-ES', { weekday: 'long' })}</strong><br>${d.toLocaleDateString()}</div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

function renderDayView(container, date) {
    container.innerHTML = `<h3 style="text-align:center;margin-bottom:1rem;color:var(--usac-blue);">${date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
    <div style="text-align:center;padding:2rem;">
        <p>Selecciona un horario</p>
        <div style="display:grid;gap:0.5rem;margin-top:1rem;">
            ${['8:00 AM','10:00 AM','12:00 PM','2:00 PM','4:00 PM'].map(t => `<div style="padding:1rem;background:var(--gray-200);border-radius:4px;">${t} — Disponible</div>`).join('')}
        </div>
    </div>`;
}

/* ============================================================
   EVENT LISTENERS E INICIALIZACIÓN
   ============================================================ */
function setupEventListeners() {
    document.getElementById('btn-enter')?.addEventListener('click', showAuthModal);
    document.getElementById('login-form')?.addEventListener('submit', handleAuth);
    document.getElementById('register-form')?.addEventListener('submit', handleAuth);
    // Admin form: listener asíncrono
    document.getElementById('admin-form')?.addEventListener('submit', (e) => handleAdminAccess(e));

    document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn =>
        btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab))
    );

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

    document.querySelectorAll('.view-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            calendarView = btn.dataset.view;
            renderCalendar();
        })
    );

    // Cerrar modales al hacer clic en el backdrop
    document.querySelectorAll('.modal-backdrop').forEach(modal =>
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
        })
    );

    // Cerrar dropdown al hacer clic fuera
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
        if (!url) return; // ocultar si sin URL

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

    // Si no hay ninguna red, mostrar iconos de placeholder
    if (container.childElementCount === 0) {
        container.innerHTML = '<span class="footer-social-empty">Sin redes sociales configuradas</span>';
    }
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

        // Feedback visual
        const btn = form.querySelector('button[type="submit"]');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> ¡Guardado!';
        btn.style.background = '#22c55e';
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.background = '';
        }, 2000);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    applyStoredTheme();
    setupEventListeners();
    setupSocialForm();
    renderSocialLinks();
    loadSocialFormValues();
    const session = store.get(KEYS.session);
    if (session) loginSuccess(session);
    studentSessionDocs = 0;
    studentSessionAnns = 0;
});

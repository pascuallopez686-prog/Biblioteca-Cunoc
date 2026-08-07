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
    social:  'biblioteca_social_v1',
    emps:    'biblioteca_emps_v1'
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

let currentUser = null;

/* ============================================================
   NAVEGACIÓN ENTRE VISTAS
   ============================================================ */
function switchMainView(viewName) {
    closeMobileNav();
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.classList.add('hidden');

    document.querySelectorAll('.main-view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (viewName === 'biblioteca') {
        document.getElementById('public-view')?.classList.remove('hidden');
        setExclusiveTab('inicio');
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

    if (tabName === 'plataforma') {
        renderAll();
    } else if (tabName === 'emprendimientos') {
        renderEmprendimientos();
    }
}

/* ============================================================
   AUTENTICACIÓN ADMIN
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
function loginSuccess(user, isNewRegistration = false) {
    const sessionUser = sanitizeSessionUser(user);
    currentUser = sessionUser;
    store.set(KEYS.session, sessionUser);

    document.getElementById('welcome-screen')?.classList.add('hidden');
    document.getElementById('app-header')?.classList.remove('hidden');
    document.getElementById('public-view')?.classList.remove('hidden');
    document.getElementById('app-footer')?.classList.remove('hidden');
    document.getElementById('admin-panel')?.classList.add('hidden');

    updateHeaderUI();
    switchMainView('biblioteca');
    renderAll();

    const userTourKey = 'headerTourCompleted_' + (currentUser.carne || currentUser.id || 'student');
    if (isNewRegistration || !localStorage.getItem(userTourKey)) {
        localStorage.removeItem(userTourKey);
        localStorage.removeItem('headerTourCompleted');
        startHeaderTour(true);
    } else {
        startHeaderTour(false);
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem(KEYS.session);
    document.getElementById('welcome-screen')?.classList.remove('hidden');
    document.getElementById('app-header')?.classList.add('hidden');
    document.getElementById('public-view')?.classList.add('hidden');
    document.getElementById('app-footer')?.classList.add('hidden');
    document.getElementById('admin-panel')?.classList.add('hidden');
}

function enterPortalDirectly() {
    document.getElementById('welcome-screen')?.classList.add('hidden');
    document.getElementById('app-header')?.classList.remove('hidden');
    document.getElementById('public-view')?.classList.remove('hidden');
    document.getElementById('app-footer')?.classList.remove('hidden');
    document.getElementById('admin-panel')?.classList.add('hidden');

    if (!currentUser) {
        currentUser = { id: 'visitor_' + Date.now(), name: 'Visitante', role: 'public' };
    }

    updateHeaderUI();
    switchMainView('biblioteca');
    renderAll();
}

/* ============================================================
   UI Y MODALES
   ============================================================ */
function openAdminModal() {
    const m = document.getElementById('admin-modal');
    if (m) { m.classList.remove('hidden'); m.style.display = 'flex'; }
}
function closeAdminModal() {
    const m = document.getElementById('admin-modal');
    if (m) { m.classList.add('hidden'); m.style.display = 'none'; }
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
   ACCIONES DE ESTUDIANTE / VISITANTE
   ============================================================ */
function studentSendMsg(e) {
    e.preventDefault();
    const contentEl = document.getElementById('msg-content');
    if (!contentEl) return;
    const msgs = store.get(KEYS.msgs) || [];
    msgs.push({
        id: Date.now(),
        studentId: currentUser ? currentUser.id : 'anon',
        studentName: currentUser ? currentUser.name : 'Visitante',
        studentCarne: currentUser ? currentUser.carne : '',
        content: contentEl.value.trim(),
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

function renderAll() { fetchAndRenderAnnouncements(); renderMyMessages(); }

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
        } else {
            console.warn(`${DEBUG_PREFIX} Anuncios no cargados:`, data.message || response.status);
            container.innerHTML = `<p style="color:var(--gray-600);padding:1rem;">No se pudieron cargar las noticias (${data.message || response.status}).</p>`;
            return;
        }
    } catch (err) {
        console.warn(`${DEBUG_PREFIX} Sin conexión al cargar anuncios.`, err);
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
    document.getElementById('btn-enter')?.addEventListener('click', enterPortalDirectly);
    document.getElementById('admin-form')?.addEventListener('submit', (e) => handleAdminAccess(e));

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
    document.getElementById('student-msg-form')?.addEventListener('submit', studentSendMsg);

    document.getElementById('global-search')?.addEventListener('input', (e) => {
        renderAnnouncements(e.target.value);
    });

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
/* ============================================================
   EMPRENDIMIENTOS – CRUD LOCAL
   ============================================================ */

const CATEGORY_EMOJIS = {
    'Alimentación': '🍽️',
    'Moda y Accesorios': '👗',
    'Belleza y Cuidado': '💄',
    'Tecnología': '💻',
    'Arte y Artesanías': '🎨',
    'Educación': '📚',
    'Salud y Bienestar': '🌿',
    'Hogar': '🏠',
    'Servicios': '🔧',
    'Otro': '📦'
};

/* Base64 temporal para imagen del emprendimiento en formulario admin */
let _empImageBase64 = null;

function setupEmpImageUpload() {
    const input = document.getElementById('emp-image');
    if (!input) return;
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert('La imagen no debe superar 2 MB. Prueba reducir su tamaño.');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            _empImageBase64 = ev.target.result;
            const preview = document.getElementById('emp-img-preview');
            const placeholder = document.getElementById('emp-img-placeholder');
            const removeBtn = document.getElementById('emp-img-remove');
            if (preview) { preview.src = _empImageBase64; preview.style.display = 'block'; }
            if (placeholder) placeholder.style.display = 'none';
            if (removeBtn) removeBtn.style.display = 'inline-flex';
        };
        reader.readAsDataURL(file);
    });
}

function clearEmpImage() {
    _empImageBase64 = null;
    const input = document.getElementById('emp-image');
    const preview = document.getElementById('emp-img-preview');
    const placeholder = document.getElementById('emp-img-placeholder');
    const removeBtn = document.getElementById('emp-img-remove');
    if (input) input.value = '';
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) { placeholder.style.display = 'flex'; }
    if (removeBtn) removeBtn.style.display = 'none';
}

function adminAddEmp(e) {
    e.preventDefault();
    const owner    = document.getElementById('emp-owner')?.value.trim();
    const name     = document.getElementById('emp-name')?.value.trim();
    const desc     = document.getElementById('emp-desc')?.value.trim();
    const category = document.getElementById('emp-category')?.value;
    const website  = document.getElementById('emp-website')?.value.trim();
    const facebook = document.getElementById('emp-facebook')?.value.trim();
    const instagram= document.getElementById('emp-instagram')?.value.trim();
    const whatsapp = document.getElementById('emp-whatsapp')?.value.trim();

    if (!owner || !name || !desc || !category) { alert('Completa los campos obligatorios'); return; }

    const emps = store.get(KEYS.emps) || [];
    emps.unshift({
        id: Date.now(),
        owner, name, desc, category,
        website:   website   || null,
        facebook:  facebook  || null,
        instagram: instagram || null,
        whatsapp:  whatsapp  || null,
        imageBase64: _empImageBase64 || null,
        createdAt: new Date().toISOString()
    });
    store.set(KEYS.emps, emps);
    e.target.reset();
    clearEmpImage();
    alert('¡Emprendimiento publicado exitosamente!');
    renderAdminEmpList();
    renderEmprendimientos();
}

function deleteEmp(id) {
    if (!confirm('¿Eliminar este emprendimiento?')) return;
    const emps = (store.get(KEYS.emps) || []).filter(e => e.id !== id);
    store.set(KEYS.emps, emps);
    renderAdminEmpList();
    renderEmprendimientos();
}

function renderEmprendimientos() {
    const emps = store.get(KEYS.emps) || [];
    const grid = document.getElementById('emp-cards-grid');
    if (!grid) return;

    if (!emps.length) {
        grid.innerHTML = `
            <div class="emp-empty-state">
                <i class="fas fa-store-slash" style="font-size:3rem;color:var(--gray-400);display:block;margin-bottom:1rem;"></i>
                <p>Aún no hay emprendimientos publicados.<br>¡Sé el primero en aparecer aquí!</p>
            </div>`;
        return;
    }

    grid.innerHTML = emps.map(emp => {
        const emoji = CATEGORY_EMOJIS[emp.category] || '📦';
        const links = [
            emp.website   ? `<a href="${emp.website}" target="_blank" rel="noopener" class="emp-link-btn" title="Sitio Web"><i class="fas fa-globe"></i> Web</a>` : '',
            emp.facebook  ? `<a href="${emp.facebook}" target="_blank" rel="noopener" class="emp-link-btn emp-facebook" title="Facebook"><i class="fab fa-facebook-f"></i></a>` : '',
            emp.instagram ? `<a href="${emp.instagram}" target="_blank" rel="noopener" class="emp-link-btn emp-instagram" title="Instagram"><i class="fab fa-instagram"></i></a>` : '',
            emp.whatsapp  ? `<a href="${emp.whatsapp}" target="_blank" rel="noopener" class="emp-link-btn emp-whatsapp" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>` : ''
        ].filter(Boolean).join('');

        const imgHtml = emp.imageBase64
            ? `<div class="emp-card-img-wrap"><img src="${emp.imageBase64}" alt="Imagen de ${emp.name}" class="emp-card-img" loading="lazy"></div>`
            : `<div class="emp-card-img-wrap emp-card-img-placeholder">
                <span class="emp-placeholder-emoji">${emoji}</span>
               </div>`;

        return `
        <div class="emp-card theme-card">
            ${imgHtml}
            <div class="emp-card-header">
                <span class="emp-category-badge">${emoji} ${emp.category}</span>
            </div>
            <div class="emp-card-body">
                <h3 class="emp-name">${emp.name}</h3>
                <p class="emp-owner"><i class="fas fa-user" style="color:var(--bronze);margin-right:.3rem"></i>${emp.owner}</p>
                <p class="emp-desc">${emp.desc}</p>
            </div>
            <div class="emp-card-footer">
                ${links || '<span style="color:var(--gray-400);font-size:.8rem;">Sin links</span>'}
            </div>
        </div>`;
    }).join('');
}

function renderAdminEmpList() {
    const emps = store.get(KEYS.emps) || [];
    const container = document.getElementById('admin-emp-list');
    if (!container) return;
    if (!emps.length) {
        container.innerHTML = '<p style="color:var(--gray-500);">No hay emprendimientos publicados aún.</p>';
        return;
    }
    container.innerHTML = emps.map(emp => `
        <div class="message-card" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.75rem;">
                <div style="display:flex;align-items:center;gap:.75rem;flex:1;min-width:0;">
                    ${emp.imageBase64
                        ? `<img src="${emp.imageBase64}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0;">`
                        : `<div style="width:48px;height:48px;border-radius:8px;background:var(--gray-200);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">${CATEGORY_EMOJIS[emp.category] || '📦'}</div>`
                    }
                    <div style="min-width:0;">
                        <strong>${emp.name}</strong> &mdash; <em>${emp.category}</em><br>
                        <span style="font-size:.85rem;color:var(--gray-500);">Por: ${emp.owner}</span>
                    </div>
                </div>
                <button onclick="deleteEmp(${emp.id})" class="btn-small" style="background:#e53e3e;color:#fff;flex-shrink:0;">Eliminar</button>
            </div>
            <p style="font-size:.85rem;margin:.5rem 0 0;">${emp.desc}</p>
        </div>
    `).join('');
}

function setupEmpForm() {
    document.getElementById('admin-emp-form')?.addEventListener('submit', adminAddEmp);
    setupEmpImageUpload();
}


window.addEventListener('DOMContentLoaded', async () => {
    applyStoredTheme();
    applyImageInteractivity(document);
    setupEventListeners();
    setupSocialForm();
    setupEmpForm();
    renderSocialLinks();
    loadSocialFormValues();
    renderEmprendimientos();
    renderAdminEmpList();

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

/* ==== Guided Header Tour Functions (Sequential Step-by-Step) ==== */
let tourButtons = [];
let tourCurrentIndex = 0;

function getButtonDescription(btn) {
    const text = (btn.innerText || '').trim();
    const title = btn.getAttribute('title') || btn.getAttribute('aria-label') || '';

    if (title.includes('Biblioteca') || text.includes('Biblioteca')) {
        return {
            title: 'Logo Biblioteca Digital',
            desc: 'Te lleva al catálogo principal de libros y documentos académicos.'
        };
    }
    if (title.includes('AETSRO') || text.includes('AETSRO')) {
        return {
            title: 'Sección AETSRO',
            desc: 'Muestra novedades de la Asociación de Estudiantes de Trabajo Social.'
        };
    }
    if (title.includes('Consejo') || text.includes('Consejo')) {
        return {
            title: 'Consejo Elvira Barreno',
            desc: 'Acceso directo a comunicados y publicaciones del Consejo Estudiantil.'
        };
    }
    if (text.includes('Cursos')) {
        return {
            title: 'Cursos y Recursos',
            desc: 'Explora plataformas globales de estudio y recursos educativos.'
        };
    }
    if (text.includes('IA')) {
        return {
            title: 'Herramientas de IA',
            desc: 'Asistentes inteligentes para redacción y análisis de textos académicos.'
        };
    }
    if (text.includes('Plataforma')) {
        return {
            title: 'Plataforma General',
            desc: 'Acceso al Muro de Noticias, Biblioteca Drive y Canales de Comunicación.'
        };
    }
    if (btn.id === 'btn-admin-access' || text.includes('Admin')) {
        return {
            title: 'Acceso Administración',
            desc: 'Módulo de ingreso para administradores y docentes autorizados.'
        };
    }
    if (btn.id === 'btn-theme' || title.includes('tema')) {
        return {
            title: 'Modo Oscuro / Claro',
            desc: 'Cambia el contraste visual de la página para descansar tu vista.'
        };
    }

    return {
        title: title || text || 'Botón de Encabezado',
        desc: 'Opción de navegación principal para explorar la plataforma.'
    };
}

function startHeaderTour(force = false) {
    const userTourKey = currentUser ? 'headerTourCompleted_' + (currentUser.carne || currentUser.id) : 'headerTourCompleted_guest';
    if (!force && localStorage.getItem(userTourKey)) return;

    // Delay execution slightly so browser paints header layout after removing .hidden class
    setTimeout(() => {
        const header = document.getElementById('app-header');
        if (!header) return;

        // Select all header buttons and dropdown triggers
        const allButtons = Array.from(header.querySelectorAll('button, .dropbtn'));
        tourButtons = allButtons.filter(btn => {
            if (btn.classList.contains('hidden')) return false;
            if (btn.id === 'btn-admin-panel' && (!currentUser || !currentUser.isAdmin)) return false;
            if (btn.id === 'btn-logout') return false; // Exclude logout button from auto-clicking tour
            
            const style = window.getComputedStyle(btn);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });

        if (tourButtons.length === 0) return;

        tourCurrentIndex = 0;
        showTourStep(tourCurrentIndex);
    }, 600);
}

function showTourStep(index) {
    removeAllTooltips(false);

    if (index >= tourButtons.length) {
        finishHeaderTour();
        return;
    }

    const btn = tourButtons[index];
    if (!btn) {
        finishHeaderTour();
        return;
    }

    if (!btn.id) {
        btn.id = 'tour-btn-' + Math.random().toString(36).substr(2, 9);
    }

    btn.classList.add('tour-highlight');

    try {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } catch (e) {}

    const rect = btn.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    tooltip.id = 'active-tour-tooltip';

    // Position tooltip nicely below button
    const topPos = Math.max(10, rect.bottom + window.scrollY + 10);
    const leftPos = Math.max(10, Math.min(window.innerWidth - 310, rect.left + window.scrollX + (rect.width / 2) - 140));

    tooltip.style.top = `${topPos}px`;
    tooltip.style.left = `${leftPos}px`;

    const info = getButtonDescription(btn);
    const isLast = (index === tourButtons.length - 1);
    const actionText = isLast ? 'Entendido y Finalizar' : 'Probar e Ir ➔';

    tooltip.innerHTML = `
        <div class="tour-header">
            <span class="tour-step-tag">PASO ${index + 1} DE ${tourButtons.length}</span>
            <button class="tour-close-btn" title="Cerrar tour" onclick="finishHeaderTour()">✕</button>
        </div>
        <div class="tour-body">
            <h4 class="tour-title">${info.title}</h4>
            <p class="tour-desc">${info.desc}</p>
        </div>
        <div class="tour-footer">
            <button class="tour-next-btn" onclick="advanceTourStep(${index})">${actionText}</button>
        </div>
    `;

    document.body.appendChild(tooltip);
}

function advanceTourStep(index) {
    const btn = tourButtons[index];
    if (btn && btn.id !== 'btn-logout' && btn.id !== 'btn-admin-access' && btn.id !== 'btn-admin-panel') {
        try {
            btn.click();
        } catch (e) {}
    }
    tourCurrentIndex = index + 1;
    setTimeout(() => {
        showTourStep(tourCurrentIndex);
    }, 450);
}

function removeAllTooltips(markCompleted = false) {
    document.querySelectorAll('.tour-tooltip').forEach(t => t.remove());
    document.querySelectorAll('.tour-highlight').forEach(b => b.classList.remove('tour-highlight'));
    if (markCompleted) {
        const userTourKey = currentUser ? 'headerTourCompleted_' + (currentUser.carne || currentUser.id) : 'headerTourCompleted_guest';
        localStorage.setItem(userTourKey, 'true');
    }
}

function finishHeaderTour() {
    removeAllTooltips(true);
    closeAdminModal();
}

// Expose globally for browser console debugging / testing
window.startHeaderTour = startHeaderTour;
window.resetHeaderTour = function() {
    if (currentUser) {
        localStorage.removeItem('headerTourCompleted_' + (currentUser.carne || currentUser.id));
    }
    localStorage.removeItem('headerTourCompleted');
    startHeaderTour(true);
};
/* ==== End Guided Header Tour Functions ==== */
/* ==== End Guided Header Tour Functions ==== */

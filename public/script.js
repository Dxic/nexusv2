/**
 * NEXUS CHAT v2 — Client Script
 * Fitur: random username per tab, join/create room berpassword,
 *        leave confirmation modal, share lokasi via Google Maps
 */
(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────────── */
  let socket;
  let currentUser = '';
  let currentRoom = '';
  let typingTimer;
  let isTypingSent  = false;
  let typingUsers   = new Set();
  let lastAuthor    = '';

  /* ── DOM refs ──────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);

  const screenIdentity   = $('screen-identity');
  const screenLobby      = $('screen-lobby');
  const screenChat       = $('screen-chat');

  const identityDisplay  = $('identity-display');
  const btnIdentityCont  = $('btn-identity-continue');
  const lobbyUsername    = $('lobby-username');

  const joinRoomName     = $('join-room-name');
  const joinPassword     = $('join-password');
  const joinRoomStatus   = $('join-room-status');
  const btnJoin          = $('btn-join');
  const joinError        = $('join-error');

  const createRoomName   = $('create-room-name');
  const createPassword   = $('create-password');
  const createPassword2  = $('create-password2');
  const btnCreate        = $('btn-create');
  const createError      = $('create-error');

  const sidebarRoomName  = $('sidebar-room-name');
  const headerRoomName   = $('header-room-name');
  const chatUsername     = $('chat-username');
  const onlineList       = $('online-list');
  const onlineCount      = $('online-count');
  const messagesList     = $('messages-list');
  const messagesWrap     = $('messages-wrap');
  const msgInput         = $('msg-input');
  const btnSend          = $('btn-send');
  const typingRow        = $('typing-row');
  const typingText       = $('typing-text');
  const connDot          = $('conn-dot');
  const btnLeave         = $('btn-leave');
  const menuBtn          = $('menu-btn');
  const sidebar          = $('sidebar');
  const sidebarOverlay   = $('sidebar-overlay');
  const sidebarClose     = $('sidebar-close');
  const expireWarning    = $('expire-warning');

  // Modal keluar
  const leaveModal       = $('leave-modal');
  const leaveRoomName    = $('leave-room-name');
  const btnCancelLeave   = $('btn-cancel-leave');
  const btnConfirmLeave  = $('btn-confirm-leave');

  // Share lokasi
  const btnLoc           = $('btn-loc');
  const btnLocHeader     = $('btn-loc-header');
  const locModal         = $('loc-modal');

  /* ══════════════════════════════════════
     SCREEN: IDENTITY
  ══════════════════════════════════════ */
  async function initIdentity() {
    // sessionStorage = unik per tab, tidak share antar tab
    const saved = sessionStorage.getItem('nexus_username');
    if (saved) { currentUser = saved; showIdentity(saved); return; }

    identityDisplay.innerHTML = '<span class="id-shimmer">generating…</span>';
    try {
      const res  = await fetch('/api/username', { method: 'POST' });
      const data = await res.json();
      currentUser = data.username;
      sessionStorage.setItem('nexus_username', currentUser);
      showIdentity(currentUser);
    } catch (e) {
      identityDisplay.textContent = 'error — reload halaman';
    }
  }

  function showIdentity(name) { identityDisplay.textContent = name; }

  btnIdentityCont.addEventListener('click', () => {
    if (!currentUser) return;
    lobbyUsername.textContent = currentUser;
    showScreen(screenLobby);
  });

  /* ══════════════════════════════════════
     SCREEN: LOBBY
  ══════════════════════════════════════ */
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab).classList.add('active');
      joinError.textContent = '';
      createError.textContent = '';
    });
  });

  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = $(btn.dataset.target);
      inp.type  = inp.type === 'password' ? 'text' : 'password';
    });
  });

  // Cek keberadaan room saat ketik nama
  let checkTimer;
  joinRoomName.addEventListener('input', () => {
    clearTimeout(checkTimer);
    const name = joinRoomName.value.trim().toLowerCase();
    if (!name) { joinRoomStatus.textContent = ''; joinRoomStatus.className = 'room-status'; return; }
    joinRoomStatus.textContent = 'mengecek…';
    joinRoomStatus.className   = 'room-status checking';
    checkTimer = setTimeout(() => checkRoomExists(name), 500);
  });

  async function checkRoomExists(name) {
    try {
      const res  = await fetch(`/api/rooms/${encodeURIComponent(name)}/info`);
      const data = await res.json();
      if (data.exists) {
        joinRoomStatus.textContent = `✓ Room ditemukan · ${data.members} online`;
        joinRoomStatus.className   = 'room-status found';
      } else {
        joinRoomStatus.textContent = '✗ Room tidak ditemukan atau sudah expired';
        joinRoomStatus.className   = 'room-status not-found';
      }
    } catch (_) { joinRoomStatus.textContent = ''; }
  }

  /* JOIN */
  btnJoin.addEventListener('click', doJoin);
  joinPassword.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });

  async function doJoin() {
    const name = joinRoomName.value.trim().toLowerCase();
    const pw   = joinPassword.value;
    if (!name) { shake(joinRoomName); return; }
    if (!pw)   { shake(joinPassword); return; }

    joinError.textContent = '';
    btnJoin.disabled      = true;
    btnJoin.textContent   = 'Mengecek…';
    try {
      const res  = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password: pw })
      });
      const data = await res.json();
      if (!res.ok) { joinError.textContent = data.error || 'Gagal masuk'; return; }
      currentRoom = data.room;
      enterChat();
    } catch (_) {
      joinError.textContent = 'Koneksi error. Coba lagi.';
    } finally {
      btnJoin.disabled    = false;
      btnJoin.textContent = 'Masuk Room →';
    }
  }

  /* CREATE */
  btnCreate.addEventListener('click', doCreate);

  async function doCreate() {
    const name = createRoomName.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    const pw   = createPassword.value;
    const pw2  = createPassword2.value;

    if (!name)         { createError.textContent = 'Masukkan nama room'; shake(createRoomName); return; }
    if (pw.length < 4) { createError.textContent = 'Password minimal 4 karakter'; shake(createPassword); return; }
    if (pw !== pw2)    { createError.textContent = 'Password tidak sama'; shake(createPassword2); return; }

    createError.textContent = '';
    btnCreate.disabled      = true;
    btnCreate.textContent   = 'Membuat…';
    try {
      const res  = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password: pw, createdBy: currentUser })
      });
      const data = await res.json();
      if (!res.ok) { createError.textContent = data.error || 'Gagal membuat room'; return; }
      currentRoom = data.room;
      enterChat();
    } catch (_) {
      createError.textContent = 'Koneksi error. Coba lagi.';
    } finally {
      btnCreate.disabled    = false;
      btnCreate.textContent = 'Buat Room →';
    }
  }

  /* ══════════════════════════════════════
     SCREEN: CHAT
  ══════════════════════════════════════ */
  function enterChat() {
    sidebarRoomName.textContent = currentRoom;
    headerRoomName.textContent  = currentRoom;
    chatUsername.textContent    = currentUser;
    msgInput.placeholder        = `Tulis pesan di #${currentRoom}…`;
    clearMessages();
    showScreen(screenChat);
    closeSidebar();
    initSocket();
  }

  function initSocket() {
    if (socket) socket.disconnect();
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect',       () => { setConn('connected'); socket.emit('enterRoom', { username: currentUser, room: currentRoom }); });
    socket.on('disconnect',    () => setConn('disconnected'));
    socket.on('connect_error', () => setConn('disconnected'));

    socket.on('messageHistory', msgs => {
      clearMessages();
      msgs.forEach(m => appendMsg(m.username, m.message, m.timestamp, m.type, m.meta));
      scrollBottom();
    });

    socket.on('message', ({ username, message, timestamp, type, meta }) => {
      appendMsg(username, message, timestamp, type, meta);
      scrollBottom();
      if (username !== currentUser) ping();
    });

    socket.on('systemMessage', ({ text }) => { appendSystem(text); scrollBottom(); });

    socket.on('roomUsers', ({ room, users }) => {
      if (room !== currentRoom) return;
      renderUsers(users);
      expireWarning.style.display = users.length <= 1 ? 'block' : 'none';
    });

    socket.on('typing', ({ username, isTyping }) => {
      if (username === currentUser) return;
      isTyping ? typingUsers.add(username) : typingUsers.delete(username);
      renderTyping();
    });
  }

  /* Send */
  btnSend.addEventListener('click', sendMsg);
  msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
  msgInput.addEventListener('input', () => { autoResize(msgInput); emitTyping(true); });

  function sendMsg() {
    const text = msgInput.value.trim();
    if (!text || !socket) return;
    socket.emit('chatMessage', { message: text });
    msgInput.value = '';
    autoResize(msgInput);
    emitTyping(false, true);
  }

  function emitTyping(isTyping, force = false) {
    if (force) {
      if (isTypingSent) { socket.emit('typing', { isTyping: false }); isTypingSent = false; }
      clearTimeout(typingTimer); return;
    }
    if (!isTypingSent) { socket.emit('typing', { isTyping: true }); isTypingSent = true; }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { socket.emit('typing', { isTyping: false }); isTypingSent = false; }, 1800);
  }

  /* ══════════════════════════════════════
     KELUAR GRUP — dengan konfirmasi modal
  ══════════════════════════════════════ */
  btnLeave.addEventListener('click', () => {
    leaveRoomName.textContent = currentRoom;
    leaveModal.style.display  = 'flex';
  });

  btnCancelLeave.addEventListener('click', () => {
    leaveModal.style.display = 'none';
  });

  btnConfirmLeave.addEventListener('click', () => {
    leaveModal.style.display = 'none';
    if (socket) socket.disconnect();
    typingUsers.clear();
    lastAuthor  = '';
    currentRoom = '';
    closeSidebar();
    showScreen(screenLobby);
  });

  // Tutup modal keluar kalau klik backdrop
  leaveModal.addEventListener('click', e => {
    if (e.target === leaveModal) leaveModal.style.display = 'none';
  });

  /* ══════════════════════════════════════
     SHARE LOKASI
  ══════════════════════════════════════ */
  function doShareLocation() {
    if (!navigator.geolocation) {
      alert('Browser kamu tidak mendukung geolocation.');
      return;
    }
    locModal.style.display = 'flex';
    navigator.geolocation.getCurrentPosition(
      pos => {
        locModal.style.display = 'none';
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        // Kirim sebagai pesan tipe lokasi
        socket.emit('chatMessage', {
          message: mapsUrl,
          type:    'location',
          meta:    { lat, lng }
        });
      },
      err => {
        locModal.style.display = 'none';
        if (err.code === 1) alert('Izin lokasi ditolak. Aktifkan akses lokasi di browser.');
        else alert('Gagal mendapatkan lokasi. Coba lagi.');
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  btnLoc.addEventListener('click', doShareLocation);
  btnLocHeader.addEventListener('click', doShareLocation);

  /* ══════════════════════════════════════
     SIDEBAR MOBILE
  ══════════════════════════════════════ */
  menuBtn.addEventListener('click', openSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ── Render helpers ────────────────────────────────────────── */
  function appendMsg(username, message, timestamp, type, meta) {
    const isSelf  = username === currentUser;
    const isFirst = username !== lastAuthor;
    const row     = document.createElement('div');
    row.className = `msg-row ${isSelf ? 'self' : 'other'}`;

    if (isFirst) {
      const m = document.createElement('div');
      m.className = 'msg-meta';
      m.innerHTML = `<span class="msg-username">${esc(username)}</span><span class="msg-time">${fmtTime(timestamp)}</span>`;
      row.appendChild(m);
    }

    if (type === 'location' && meta) {
      // Render sebagai kartu lokasi yang bisa diklik
      const link       = document.createElement('a');
      link.className   = 'loc-bubble';
      link.href        = `https://www.google.com/maps?q=${meta.lat},${meta.lng}`;
      link.target      = '_blank';
      link.rel         = 'noopener noreferrer';
      link.innerHTML   = `
        <span class="loc-bubble-icon">📍</span>
        <span class="loc-bubble-text">
          <span class="loc-bubble-label">Lokasi dibagikan</span>
          <span class="loc-bubble-coords">${meta.lat}, ${meta.lng}</span>
        </span>`;
      row.appendChild(link);
    } else {
      const bubble     = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.innerHTML = esc(message).replace(/\n/g, '<br>');
      row.appendChild(bubble);
    }

    messagesList.appendChild(row);
    lastAuthor = username;
  }

  function appendSystem(text) {
    const row     = document.createElement('div');
    row.className = 'msg-row system';
    row.innerHTML = `<span class="system-pill">${esc(text)}</span>`;
    messagesList.appendChild(row);
    lastAuthor = '';
  }

  function clearMessages() {
    messagesList.innerHTML = '<div class="day-sep"><span>Hari ini</span></div>';
    lastAuthor = '';
  }

  function renderUsers(users) {
    onlineCount.textContent = users.length;
    onlineList.innerHTML = users.map(u =>
      `<li class="online-item${u === currentUser ? ' is-self' : ''}">
         <span class="dot-green"></span>${esc(u)}
       </li>`
    ).join('');
  }

  function renderTyping() {
    const names = [...typingUsers];
    if (!names.length) {
      typingRow.classList.remove('active');
      typingText.textContent = '';
    } else {
      typingRow.classList.add('active');
      typingText.textContent = names.length === 1
        ? `${names[0]} sedang mengetik…`
        : `${names.slice(0,-1).join(', ')} dan ${names.slice(-1)} sedang mengetik…`;
    }
  }

  /* ── Utilities ─────────────────────────────────────────────── */
  function showScreen(target) {
    [screenIdentity, screenLobby, screenChat].forEach(s => s.classList.remove('active'));
    target.classList.add('active');
  }

  function scrollBottom() {
    messagesWrap.scrollTop = messagesWrap.scrollHeight;
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  }

  function setConn(state) { connDot.className = `conn-dot ${state}`; connDot.title = state; }

  function fmtTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function shake(el) {
    el.style.animation = 'none'; el.offsetHeight;
    el.style.animation = 'shake 0.38s ease';
    el.addEventListener('animationend', () => el.style.animation = '', { once: true });
  }

  function ping() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o.start(); o.stop(ctx.currentTime + 0.22);
    } catch (_) {}
  }

  /* ── Boot ──────────────────────────────────────────────────── */
  initIdentity();

})();

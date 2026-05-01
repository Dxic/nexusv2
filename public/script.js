/**
 * NEXUS CHAT v3 — Client Script
 * Fitur: upload foto/file, hapus room (pembuat), share lokasi, leave confirm
 */
(function () {
  'use strict';

  /* ── State ── */
  let socket, currentUser = '', currentRoom = '', roomOwner = '';
  let typingTimer, isTypingSent = false, typingUsers = new Set(), lastAuthor = '';
  let pendingFile = null;
  let mediaRecorder = null, audioChunks = [], audioContext = null, analyser = null, drawVisual = null, recStart = 0, recInterval = null;

  /* ── DOM ── */
  const $ = id => document.getElementById(id);
  const sIdentity = $('s-identity'), sLobby = $('s-lobby'), sChat = $('s-chat');
  const identityDisplay = $('identity-display'), lobbyUname = $('lobby-uname');
  const joinName = $('join-name'), joinPw = $('join-pw'), joinRoomHint = $('join-room-hint');
  const btnJoin = $('btn-join'), joinErr = $('join-err');
  const crName = $('cr-name'), crPw = $('cr-pw'), crPw2 = $('cr-pw2');
  const btnCreate = $('btn-create'), createErr = $('create-err');
  const sbRoomName = $('sb-room-name'), headRoom = $('head-room');
  const sbUname = $('sb-uname'), onlineList = $('online-list'), onlineCnt = $('online-cnt');
  const msgsList = $('msgs-list'), msgsWrap = $('msgs-wrap');
  const msgInput = $('msg-input'), btnSend = $('btn-send');
  const typingBar = $('typing-bar'), typingTxt = $('typing-txt');
  const connDot = $('conn-dot'), sbExpire = $('sb-expire');
  const btnLeave = $('btn-leave'), btnDeleteRoom = $('btn-delete-room');
  const sidebar = $('sidebar'), sbOverlay = $('sb-overlay'), sbClose = $('sb-close'), menuBtn = $('menu-btn');
  const modalLeave = $('modal-leave'), modalLeaveRoom = $('modal-leave-room');
  const btnCancelLeave = $('btn-cancel-leave'), btnConfirmLeave = $('btn-confirm-leave');
  const modalDelete = $('modal-delete'), modalDeleteRoom = $('modal-delete-room');
  const btnCancelDelete = $('btn-cancel-delete'), btnConfirmDelete = $('btn-confirm-delete');
  const modalLoc = $('modal-loc');
  const fileInput = $('file-input'), filePreview = $('file-preview');
  const fpImg = $('fp-img'), fpFile = $('fp-file'), fpName = $('fp-name'), fpRemove = $('fp-remove');
  const btnLoc = $('btn-loc'), btnLocHd = $('btn-loc-hd');
  const uploadToast = $('upload-toast'), utBar = $('ut-bar'), utLabel = $('ut-label');
  const btnMic = $('btn-mic'), recordUi = $('record-ui'), btnCancelRec = $('btn-cancel-rec'), btnSendRec = $('btn-send-rec'), recTime = $('rec-time'), recCanvas = $('rec-canvas');

  /* ════════════════════════════════
     SCREEN: IDENTITY
  ════════════════════════════════ */
  async function initIdentity() {
    const saved = sessionStorage.getItem('nexus_username');
    if (saved) { currentUser = saved; identityDisplay.textContent = saved; return; }
    try {
      const res  = await fetch('/api/username', { method: 'POST' });
      const data = await res.json();
      currentUser = data.username;
      sessionStorage.setItem('nexus_username', currentUser);
      identityDisplay.textContent = currentUser;
    } catch { identityDisplay.textContent = 'error — reload halaman'; }
  }

  $('btn-identity-continue').addEventListener('click', () => {
    if (!currentUser) return;
    lobbyUname.textContent = currentUser;
    showScreen(sLobby);
  });

  /* ════════════════════════════════
     SCREEN: LOBBY
  ════════════════════════════════ */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('tp-' + btn.dataset.tab).classList.add('active');
      joinErr.textContent = ''; createErr.textContent = '';
    });
  });

  document.querySelectorAll('.pw-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = $(btn.dataset.t);
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
  });

  /* Room name check */
  let checkTimer;
  joinName.addEventListener('input', () => {
    clearTimeout(checkTimer);
    const v = joinName.value.trim().toLowerCase();
    if (!v) { joinRoomHint.textContent = ''; joinRoomHint.className = 'field-hint'; return; }
    joinRoomHint.textContent = 'mengecek...'; joinRoomHint.className = 'field-hint checking';
    checkTimer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/rooms/${encodeURIComponent(v)}/info`);
        const d = await r.json();
        if (d.exists) { joinRoomHint.textContent = `✓ Ditemukan · ${d.members} online`; joinRoomHint.className = 'field-hint found'; }
        else { joinRoomHint.textContent = '✗ Tidak ditemukan atau sudah expired'; joinRoomHint.className = 'field-hint missing'; }
      } catch { joinRoomHint.textContent = ''; }
    }, 500);
  });

  /* JOIN */
  btnJoin.addEventListener('click', doJoin);
  joinPw.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });

  async function doJoin() {
    const name = joinName.value.trim().toLowerCase();
    const pw   = joinPw.value;
    if (!name) { shake(joinName); return; }
    if (!pw)   { shake(joinPw); return; }
    joinErr.textContent = ''; btnJoin.disabled = true; btnJoin.textContent = 'Mengecek...';
    try {
      const res  = await fetch('/api/rooms/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password: pw }) });
      const data = await res.json();
      if (!res.ok) { joinErr.textContent = data.error || 'Gagal masuk'; return; }
      currentRoom = data.room; roomOwner = data.createdBy || '';
      enterChat();
    } catch { joinErr.textContent = 'Koneksi error. Coba lagi.'; }
    finally { btnJoin.disabled = false; btnJoin.textContent = 'Masuk →'; }
  }

  /* CREATE */
  btnCreate.addEventListener('click', doCreate);

  async function doCreate() {
    const name = crName.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    const pw   = crPw.value, pw2 = crPw2.value;
    if (!name) { createErr.textContent = 'Masukkan nama room'; shake(crName); return; }
    if (pw.length < 4) { createErr.textContent = 'Password minimal 4 karakter'; shake(crPw); return; }
    if (pw !== pw2) { createErr.textContent = 'Password tidak sama'; shake(crPw2); return; }
    createErr.textContent = ''; btnCreate.disabled = true; btnCreate.textContent = 'Membuat...';
    try {
      const res  = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password: pw, createdBy: currentUser }) });
      const data = await res.json();
      if (!res.ok) { createErr.textContent = data.error || 'Gagal membuat room'; return; }
      currentRoom = data.room; roomOwner = currentUser;
      enterChat();
    } catch { createErr.textContent = 'Koneksi error. Coba lagi.'; }
    finally { btnCreate.disabled = false; btnCreate.textContent = 'Buat Room →'; }
  }

  /* ════════════════════════════════
     SCREEN: CHAT
  ════════════════════════════════ */
  function enterChat() {
    sbRoomName.textContent  = currentRoom;
    headRoom.textContent    = currentRoom;
    sbUname.textContent     = currentUser;
    msgInput.placeholder    = `Tulis pesan di #${currentRoom}...`;
    clearMsgs();
    // Tampilkan tombol hapus hanya untuk pembuat
    if (currentRoom && roomOwner === currentUser) {
      btnDeleteRoom.classList.remove('hidden');
    } else {
      btnDeleteRoom.classList.add('hidden');
    }
    showScreen(sChat);
    closeSidebar();
    initSocket();
  }

  function initSocket() {
    if (socket) socket.disconnect();
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      setConn('connecting');
      socket.emit('enterRoom', { username: currentUser, room: currentRoom });
      setConn('connected');
    });
    socket.on('disconnect',    () => setConn('disconnected'));
    socket.on('connect_error', () => setConn('disconnected'));

    socket.on('messageHistory', msgs => {
      clearMsgs();
      msgs.forEach(m => appendMsg(m));
      scrollBottom();
    });

    socket.on('message', msg => {
      appendMsg(msg);
      scrollBottom();
      if (msg.username !== currentUser) ping();
    });

    socket.on('systemMessage', ({ text }) => { appendSystem(text); scrollBottom(); });

    socket.on('roomUsers', ({ room, users }) => {
      if (room !== currentRoom) return;
      renderUsers(users);
      sbExpire.classList.toggle('hidden', users.length > 1);
    });

    socket.on('typing', ({ username, isTyping }) => {
      if (username === currentUser) return;
      isTyping ? typingUsers.add(username) : typingUsers.delete(username);
      renderTyping();
    });

    /* Room dihapus oleh pembuat */
    socket.on('roomDeleted', ({ message }) => {
      appendSystem(message);
      scrollBottom();
      setTimeout(() => {
        if (socket) socket.disconnect();
        currentRoom = ''; roomOwner = '';
        showScreen(sLobby);
      }, 2500);
    });

    socket.on('error', ({ message }) => {
      appendSystem(`⚠ ${message}`);
    });
  }

  /* ── Send ── */
  btnSend.addEventListener('click', sendMsg);
  msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
  msgInput.addEventListener('input', () => { autoResize(msgInput); emitTyping(true); });

  async function sendMsg() {
    if (pendingFile) { await uploadAndSend(); return; }
    const text = msgInput.value.trim();
    if (!text || !socket) return;
    socket.emit('chatMessage', { message: text, type: 'text' });
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

  /* ── File upload ── */
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    pendingFile = file;
    const isImg = file.type.startsWith('image/');
    filePreview.classList.remove('hidden');
    if (isImg) {
      if (fpImg.src) URL.revokeObjectURL(fpImg.src);
      fpImg.src = URL.createObjectURL(file);
      fpImg.classList.remove('hidden');
      fpFile.classList.add('hidden');
    } else {
      fpImg.classList.add('hidden');
      fpFile.classList.remove('hidden');
      document.getElementById('fp-name').textContent = file.name;
    }
    msgInput.focus();
  });

  fpRemove.addEventListener('click', () => {
    pendingFile = null; fileInput.value = '';
    filePreview.classList.add('hidden');
    if (fpImg.src) { URL.revokeObjectURL(fpImg.src); fpImg.src = ''; }
  });

  /* ── Voice Notes ── */
  btnMic.addEventListener('click', startRecording);
  btnCancelRec.addEventListener('click', () => stopRecording(false));
  btnSendRec.addEventListener('click', () => stopRecording(true));

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      
      recordUi.classList.remove('hidden');
      msgInput.classList.add('hidden');
      btnMic.classList.add('hidden');
      btnSend.classList.add('hidden');
      btnLoc.classList.add('hidden');
      document.querySelector('label[for="file-input"]').classList.add('hidden');
      
      recStart = Date.now();
      recInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - recStart) / 1000);
        recTime.textContent = `${String(Math.floor(sec / 60)).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}`;
      }, 1000);

      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvasCtx = recCanvas.getContext('2d');

      function draw() {
        if (!recordUi.classList.contains('hidden')) drawVisual = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, recCanvas.width, recCanvas.height);
        const barWidth = (recCanvas.width / bufferLength) * 1.5;
        let x = 0;
        for(let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * recCanvas.height;
          canvasCtx.fillStyle = '#3b82f6';
          canvasCtx.beginPath();
          canvasCtx.roundRect(x, recCanvas.height - barHeight, barWidth - 2, barHeight, 4);
          canvasCtx.fill();
          x += barWidth;
        }
      }
      
      recCanvas.width = recCanvas.offsetWidth;
      recCanvas.height = recCanvas.offsetHeight;
      draw();
      mediaRecorder.start();
    } catch (err) { alert('Gagal mengakses mikrofon: ' + err.message); }
  }

  function stopRecording(send) {
    if (!mediaRecorder) return;
    clearInterval(recInterval);
    cancelAnimationFrame(drawVisual);
    
    mediaRecorder.onstop = async () => {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
      
      recordUi.classList.add('hidden');
      msgInput.classList.remove('hidden');
      btnMic.classList.remove('hidden');
      btnSend.classList.remove('hidden');
      btnLoc.classList.remove('hidden');
      document.querySelector('label[for="file-input"]').classList.remove('hidden');
      recTime.textContent = '00:00';
      
      if (send && audioChunks.length > 0) {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        await uploadAndSendAudio(blob);
      }
      audioChunks = [];
    };
    mediaRecorder.stop();
  }

  async function uploadAndSendAudio(blob) {
    const formData = new FormData();
    formData.append('file', blob, 'voicenote.webm');
    utBar.style.width = '30%'; utLabel.textContent = 'Mengunggah Voice Note...'; uploadToast.classList.remove('hidden');
    
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error();
      const data = await res.json();
      utBar.style.width = '100%'; utLabel.textContent = 'Selesai!';
      setTimeout(() => uploadToast.classList.add('hidden'), 1000);
      
      socket.emit('chatMessage', {
        message: 'Voice Note', type: 'audio',
        meta: { url: data.url, filename: 'voicenote.webm', mime: 'audio/webm' }
      });
    } catch {
      utLabel.textContent = 'Upload gagal.';
      setTimeout(() => uploadToast.classList.add('hidden'), 2500);
    }
  }

  async function uploadAndSend() {
    if (!pendingFile) return;
    const caption = msgInput.value.trim();
    const file    = pendingFile;
    clearFilePreview();
    msgInput.value = '';

    /* Tampilkan progress toast */
    uploadToast.classList.remove('hidden');
    utLabel.textContent = 'Mengunggah...';
    utBar.style.width   = '10%';

    const form = new FormData();
    form.append('file', file);

    try {
      /* Simulasi progress */
      let prog = 10;
      const tick = setInterval(() => { prog = Math.min(prog + 8, 85); utBar.style.width = prog + '%'; }, 300);

      const res  = await fetch('/api/upload', { method: 'POST', body: form });
      clearInterval(tick);

      if (!res.ok) {
        const err = await res.json();
        utLabel.textContent = err.error || 'Upload gagal';
        utBar.style.width   = '100%';
        setTimeout(() => uploadToast.classList.add('hidden'), 2500);
        return;
      }

      const data = await res.json();
      utBar.style.width = '100%';
      utLabel.textContent = 'Selesai!';
      setTimeout(() => uploadToast.classList.add('hidden'), 1000);

      const isImg = file.type.startsWith('image/');
      socket.emit('chatMessage', {
        message:  caption || file.name,
        type:     isImg ? 'image' : 'file',
        meta:     { url: data.url, filename: file.name, size: file.size, mime: file.type }
      });
    } catch {
      utLabel.textContent = 'Upload gagal. Coba lagi.';
      setTimeout(() => uploadToast.classList.add('hidden'), 2500);
    }
  }

  /* ── Share Lokasi ── */
  [btnLoc, btnLocHd].forEach(b => b.addEventListener('click', shareLocation));

  function shareLocation() {
    if (!navigator.geolocation) { alert('Browser tidak mendukung geolocation.'); return; }
    modalLoc.style.display = 'flex';
    navigator.geolocation.getCurrentPosition(
      pos => {
        modalLoc.style.display = 'none';
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        socket.emit('chatMessage', {
          message: `https://www.google.com/maps?q=${lat},${lng}`,
          type:    'location',
          meta:    { lat, lng }
        });
      },
      err => {
        modalLoc.style.display = 'none';
        if (err.code === 1) alert('Izin lokasi ditolak. Aktifkan di browser kamu.');
        else alert('Gagal mendapatkan lokasi. Coba lagi.');
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  /* ════════════════════════════════
     MODAL: KELUAR
  ════════════════════════════════ */
  btnLeave.addEventListener('click', () => {
    modalLeaveRoom.textContent = currentRoom;
    modalLeave.style.display   = 'flex';
  });
  btnCancelLeave.addEventListener('click', () => { modalLeave.style.display = 'none'; });
  modalLeave.addEventListener('click', e => { if (e.target === modalLeave) modalLeave.style.display = 'none'; });
  btnConfirmLeave.addEventListener('click', () => {
    modalLeave.style.display = 'none';
    if (socket) socket.disconnect();
    currentRoom = ''; roomOwner = ''; typingUsers.clear(); lastAuthor = '';
    closeSidebar();
    showScreen(sLobby);
  });

  /* ════════════════════════════════
     MODAL: HAPUS ROOM
  ════════════════════════════════ */
  btnDeleteRoom.addEventListener('click', () => {
    modalDeleteRoom.textContent = currentRoom;
    modalDelete.style.display   = 'flex';
  });
  btnCancelDelete.addEventListener('click', () => { modalDelete.style.display = 'none'; });
  modalDelete.addEventListener('click', e => { if (e.target === modalDelete) modalDelete.style.display = 'none'; });
  btnConfirmDelete.addEventListener('click', () => {
    modalDelete.style.display = 'none';
    if (socket) socket.emit('deleteRoom', { room: currentRoom });
  });

  /* ════════════════════════════════
     SIDEBAR MOBILE
  ════════════════════════════════ */
  menuBtn.addEventListener('click', openSidebar);
  sbClose.addEventListener('click', closeSidebar);
  sbOverlay.addEventListener('click', closeSidebar);
  function openSidebar() { sidebar.classList.add('open'); sbOverlay.classList.add('active'); }
  function closeSidebar() { sidebar.classList.remove('open'); sbOverlay.classList.remove('active'); }

  /* ════════════════════════════════
     RENDER
  ════════════════════════════════ */
  function appendMsg(msg) {
    const { username, message, type, meta, timestamp } = msg;
    const isSelf  = username === currentUser;
    const isFirst = username !== lastAuthor;
    const row     = document.createElement('div');
    row.className = `msg-row ${isSelf ? 'self' : 'other'}`;

    if (isFirst) {
      const m = document.createElement('div');
      m.className = 'msg-meta';
      m.innerHTML = `<span class="msg-user">${esc(username)}</span><span class="msg-time">${fmtTime(timestamp)}</span>`;
      row.appendChild(m);
    }

    if (type === 'image' && meta?.url) {
      const wrap = document.createElement('div');
      wrap.className = 'img-bubble';
      wrap.innerHTML = `<img src="${esc(meta.url)}" alt="${esc(meta.filename || 'foto')}" loading="lazy" onclick="window.open('${esc(meta.url)}','_blank')"/>`;
      if (message && message !== meta.filename) {
        const cap = document.createElement('div');
        cap.className = 'bubble';
        cap.style.marginTop = '4px';
        cap.innerHTML = esc(message).replace(/\n/g, '<br>');
        row.appendChild(wrap);
        row.appendChild(cap);
      } else {
        row.appendChild(wrap);
      }
    } else if (type === 'file' && meta?.url) {
      const a = document.createElement('a');
      a.className = 'file-bubble';
      a.href = meta.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.innerHTML = `
        <span class="file-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
        <span class="file-info"><span class="file-name">${esc(meta.filename || 'file')}</span><span class="file-size">${fmtSize(meta.size)}</span></span>`;
      row.appendChild(a);
    } else if (type === 'location' && meta?.lat) {
      const a = document.createElement('a');
      a.className = 'loc-bubble';
      a.href = `https://www.google.com/maps?q=${meta.lat},${meta.lng}`;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.innerHTML = `<span class="loc-icon">📍</span><span class="loc-info"><span class="loc-label">Lokasi dibagikan</span><span class="loc-coords">${meta.lat}, ${meta.lng}</span></span>`;
      row.appendChild(a);
    } else if (type === 'audio' && meta?.url) {
      const wrap = document.createElement('div');
      wrap.className = 'audio-bubble';
      wrap.innerHTML = `
        <button class="audio-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg></button>
        <div class="audio-wave"><canvas></canvas></div>
        <span class="audio-time">0:00</span>
      `;
      row.appendChild(wrap);
      
      const btn = wrap.querySelector('.audio-btn');
      const timeDisplay = wrap.querySelector('.audio-time');
      const waveCanvas = wrap.querySelector('canvas');
      const waveCtx = waveCanvas.getContext('2d');
      waveCanvas.width = 120; waveCanvas.height = 24;
      const drawStatic = (p) => {
        waveCtx.clearRect(0,0,120,24);
        waveCtx.fillStyle = isSelf ? 'rgba(255,255,255,0.4)' : 'rgba(59,130,246,0.4)';
        waveCtx.beginPath(); waveCtx.roundRect(0, 10, 120, 4, 2); waveCtx.fill();
        waveCtx.fillStyle = isSelf ? '#fff' : '#3b82f6';
        waveCtx.beginPath(); waveCtx.roundRect(0, 10, 120 * p, 4, 2); waveCtx.fill();
      };
      drawStatic(0);
      
      let audioObj = null;
      btn.addEventListener('click', () => {
        if (!audioObj) {
          audioObj = new Audio(meta.url);
          audioObj.addEventListener('timeupdate', () => {
             const m = Math.floor(audioObj.currentTime / 60);
             const s = Math.floor(audioObj.currentTime % 60).toString().padStart(2,'0');
             timeDisplay.textContent = `${m}:${s}`;
             drawStatic(audioObj.currentTime / (audioObj.duration || 1));
          });
          audioObj.addEventListener('ended', () => {
             btn.classList.remove('playing');
             btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
             drawStatic(0); timeDisplay.textContent = '0:00';
          });
        }
        
        if (audioObj.paused) {
          audioObj.play();
          btn.classList.add('playing');
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        } else {
          audioObj.pause();
          btn.classList.remove('playing');
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
        }
      });
    } else {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.innerHTML = esc(message).replace(/\n/g, '<br>');
      row.appendChild(bubble);
    }

    msgsList.appendChild(row);
    lastAuthor = username;
  }

  function appendSystem(text) {
    const row     = document.createElement('div');
    row.className = 'msg-row system';
    row.innerHTML = `<span class="sys-pill">${esc(text)}</span>`;
    msgsList.appendChild(row);
    lastAuthor = '';
  }

  function clearMsgs() {
    msgsList.innerHTML = '<div class="day-line"><span>Hari ini</span></div>';
    lastAuthor = '';
  }

  function renderUsers(users) {
    onlineCnt.textContent = users.length;
    onlineList.innerHTML  = users.map(u =>
      `<li class="online-item${u === currentUser ? ' me' : ''}"><span class="u-dot"></span>${esc(u)}</li>`
    ).join('');
  }

  function renderTyping() {
    const names = [...typingUsers];
    if (!names.length) { typingBar.classList.remove('active'); typingTxt.textContent = ''; return; }
    typingBar.classList.add('active');
    typingTxt.textContent = names.length === 1
      ? `${names[0]} sedang mengetik...`
      : `${names.slice(0,-1).join(', ')} dan ${names.slice(-1)} sedang mengetik...`;
  }

  /* ── Utils ── */
  function showScreen(t) { [sIdentity, sLobby, sChat].forEach(s => s.classList.remove('active')); t.classList.add('active'); }
  function scrollBottom() { msgsWrap.scrollTop = msgsWrap.scrollHeight; }
  function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 100) + 'px'; }
  function setConn(s) { connDot.className = `conn-dot ${s}`; }
  function fmtTime(ts) { if (!ts) return ''; return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
  function fmtSize(b) { if (!b) return ''; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function shake(el) { el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'shake .36s ease'; el.addEventListener('animationend', () => el.style.animation = '', { once: true }); }
  function ping() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      o.start(); o.stop(ctx.currentTime + 0.2);
    } catch (_) {}
  }

  /* ── Boot ── */
  initIdentity();
})();
(() => {
  const socket = io();
  const $ = (id) => document.getElementById(id);

  let me = null;
  let state = null;
  let joined = false;
  let inGame = false;
  let prevPhase = null;
  let prevCurrent = null;
  let prevDiscardTop = null;
  let playedAnimPending = false;

  const store = {
    name: () => localStorage.getItem('lama_name') || '',
    room: () => localStorage.getItem('lama_room') || '',
    player: () => localStorage.getItem('lama_player') || '',
    muted: () => localStorage.getItem('lama_muted') === '1',
  };

  const rankOf = (v) => (v === 'LLAMA' ? 7 : parseInt(v, 10));
  const canPlay = (card, top) => {
    if (top == null) return true;
    const c = rankOf(card);
    const t = rankOf(top);
    return c === t || c === ((t % 7) + 1);
  };

  const VALUE_COLORS = {
    '1': ['#e05a5a', '#a83333'],
    '2': ['#ef8a3c', '#c7651f'],
    '3': ['#e3b93f', '#b88f1c'],
    '4': ['#66b35f', '#3f8a39'],
    '5': ['#55a1dd', '#2f6f9e'],
    '6': ['#8a6cd1', '#5d469b'],
    'LLAMA': ['#d8ab77', '#8a5a2b'],
  };
  const AV_COLORS = ['#e8822c', '#4e8d46', '#3f89c9', '#8a5fb0', '#d94848', '#b9854e'];
  const NUM_FONT = { '1': 46, '2': 46, '3': 46, '4': 46, '5': 46, '6': 46 };
  let uid = 0;

  function cardSVG(v, opts = {}) {
    const [c1, c2] = VALUE_COLORS[v];
    const gid = 'cg' + ++uid;
    const isLlama = v === 'LLAMA';
    const num = isLlama ? '🦙' : v;
    const top = isLlama
      ? `<text x="12" y="20" text-anchor="middle" font-size="17">🦙</text>`
      : `<text x="12" y="21" text-anchor="middle" font-size="17">🦙</text>`;
    const label = isLlama
      ? `<text x="36" y="92" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.9)" font-weight="700" letter-spacing="1">L·L·A·M·A</text>`
      : '';
    return `<svg viewBox="0 0 72 104" role="img" aria-label="${v}">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
      </linearGradient></defs>
      <rect width="72" height="104" rx="12" fill="url(#${gid})"/>
      <rect x="3" y="3" width="66" height="98" rx="9" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
      ${top}
      <text x="36" y="${isLlama ? 62 : 66}" text-anchor="middle" font-size="${isLlama ? 40 : NUM_FONT[v] || 46}" font-weight="900" fill="#fff">${num}</text>
      <text x="60" y="94" text-anchor="middle" font-size="17">🦙</text>
      ${label}
    </svg>`;
  }

  function cardBackSVG() {
    const gid = 'cb' + ++uid;
    return `<svg viewBox="0 0 72 104">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7a5533"/><stop offset="1" stop-color="#4a2f1d"/>
        </linearGradient>
        <pattern id="${gid}p" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill="none"/>
          <rect width="7" height="7" fill="rgba(255,255,255,.07)"/>
          <rect x="7" y="7" width="7" height="7" fill="rgba(255,255,255,.07)"/>
        </pattern>
      </defs>
      <rect width="72" height="104" rx="12" fill="url(#${gid})"/>
      <rect width="72" height="104" rx="12" fill="url(#${gid}p)"/>
      <rect x="7" y="7" width="58" height="90" rx="8" fill="none" stroke="rgba(255,210,138,.4)" stroke-width="2"/>
      <circle cx="36" cy="52" r="17" fill="rgba(255,210,138,.16)" stroke="rgba(255,210,138,.55)" stroke-width="2"/>
      <text x="36" y="61" text-anchor="middle" font-size="22">🦙</text>
    </svg>`;
  }

  function miniCardSVG(v) {
    return cardSVG(v);
  }

  function tokensHTML(points) {
    const black = Math.floor(points / 10);
    const white = points % 10;
    let h = '';
    for (let i = 0; i < black; i++) h += '<span class="tk tk-b" title="10 puan"></span>';
    for (let i = 0; i < white; i++) h += '<span class="tk tk-w" title="1 puan"></span>';
    return h;
  }

  /* ---------- sound ---------- */
  let actx = null;
  let master = null;
  let muted = store.muted();

  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = muted ? 0 : 0.45;
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function beep(f0, f1, dur, type = 'sine', vol = 0.5, delay = 0) {
    try {
      const ctx = audio();
      const t0 = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(1, f0), t0);
      if (f1 != null && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    } catch (e) {}
  }
  const sfx = {
    playCard: () => { beep(380, 240, 0.09, 'triangle', 0.5); beep(520, 300, 0.06, 'sine', 0.3, 0.05); },
    draw: () => beep(220, 560, 0.16, 'sine', 0.45),
    quit: () => { beep(150, 90, 0.16, 'sawtooth', 0.4); beep(300, 200, 0.1, 'triangle', 0.25, 0.08); },
    turn: () => { beep(880, 880, 0.09, 'sine', 0.4); beep(1174, 1174, 0.14, 'sine', 0.35, 0.09); },
    roundEnd: () => [523, 659, 784].forEach((f, i) => beep(f, f, 0.16, 'triangle', 0.4, i * 0.09)),
    win: () => [523, 659, 784, 1046].forEach((f, i) => beep(f, f, 0.2, 'triangle', 0.45, i * 0.11)),
    lose: () => [392, 311, 262].forEach((f, i) => beep(f, f * 0.97, 0.22, 'sine', 0.4, i * 0.13)),
    error: () => beep(210, 180, 0.18, 'square', 0.3),
    copy: () => beep(700, 700, 0.08, 'sine', 0.3),
  };

  document.addEventListener('pointerdown', () => {
    try { audio(); } catch (e) {}
  }, { once: false });

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg, ok) {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'show';
    el.style.background = ok ? '#2f6b34' : '';
    setTimeout(() => {
      el.classList.remove('show');
      el.style.background = '';
    }, 2600);
  }
  function showMsg(text, ok) {
    const el = $('msg');
    el.textContent = text;
    el.className = 'msg' + (ok ? ' ok' : '');
  }
  function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  /* ---------- render ---------- */
  function render(s) {
    const prev = { phase: prevPhase, cur: prevCurrent, top: prevDiscardTop };
    state = s;
    const players = s.players;
    const meInfo = players.find((p) => p.id === me) || null;

    $('roundChip').textContent = `Tur ${s.round}`;
    $('roomChip').innerHTML = `Oda: ${s.code} <small>kopyala</small>`;

    const pc = $('phaseChip');
    pc.className = 'chip phase-' + s.phase;
    pc.textContent = s.phase === 'lobby' ? 'Lobi'
      : s.phase === 'playing' ? 'Oynanıyor'
      : s.phase === 'roundEnd' ? 'Tur bitti'
      : 'Oyun bitti';

    renderOpponents(players, s);
    const top = s.discardTop;
    const topChanged = prev.top !== top;
    renderTable(s, topChanged);
    renderHand(s, meInfo);
    renderActions(s, meInfo);
    renderLog(s.log);
    renderBanner(s);
    renderHint(s, meInfo);

if (s.phase === 'roundEnd' && prev.phase !== 'roundEnd') sfx.roundEnd();
    if (s.phase === 'gameOver' && prev.phase !== 'gameOver') {
      if (meInfo && s.winners.includes(me)) sfx.win();
      else sfx.lose();
    }
    if (s.phase === 'playing' && meInfo && s.me.myTurn && prev.cur !== s.currentPlayerId) sfx.turn();
    if (s.phase === 'playing' && prev.phase === 'playing' && prev.top != null && top != null && prev.top !== top) sfx.playCard();

    prevPhase = s.phase;
    prevCurrent = s.currentPlayerId;
    prevDiscardTop = top;
  }

  function renderOpponents(players, s) {
    const wrap = $('opponents');
    clearEl(wrap);
    players.forEach((p, idx) => {
      const isMe = p.id === me;
      const opp = document.createElement('div');
      opp.className = 'opp';
      if (isMe) opp.classList.add('me');
      if (s.phase === 'playing' && p.quit) opp.classList.add('quit');
      if (p.disconnected) opp.classList.add('disconnected');
      if (s.phase === 'playing' && s.currentPlayerId === p.id && !p.quit) opp.classList.add('highlight');
      const color = AV_COLORS[idx % AV_COLORS.length];
      let backs = '';
      if (s.phase === 'playing') {
        for (let i = 0; i < Math.min(p.handSize, 8); i++) backs += `<div class="mini">${cardBackSVG()}</div>`;
        if (p.handSize > 8) backs += `<span style="font-size:11px;color:#6b4a2d">+${p.handSize - 8}</span>`;
      } else if (s.phase === 'roundEnd' || s.phase === 'gameOver') {
        if (p.hand && p.hand.length) {
          const shown = p.hand.slice(0, 8);
          for (const v of shown) backs += `<div class="mini">${miniCardSVG(v)}</div>`;
          if (p.hand.length > 8) backs += `<span>+${p.hand.length - 8}</span>`;
        }
      }
      opp.innerHTML = `
        <span class="mark">ÇEKİLDİ</span>
        <span class="avatar" style="border-color:${color};box-shadow:0 2px 8px ${color}66">🦙</span>
        <div class="name">${esc(p.name)}${isMe ? ' <small>(sen)</small>' : ''}${p.isHost ? ' 🏠' : ''}</div>
        <div class="cards">${backs}</div>
        <div class="tokens">${tokensHTML(p.points)}</div>
        <div class="meta"><b>${p.points}</b> puan · ${p.handSize} kart <span class="turn-dots">…</span></div>
        <div class="conn-warn">bağlantı koptu</div>
      `;
      wrap.appendChild(opp);
    });
  }

  function renderTable(s, topChanged) {
    const dc = $('discardCard');
    dc.className = 'card big';
    if (s.discardTop) {
      dc.innerHTML = cardSVG(s.discardTop, { big: true });
      if (topChanged) {
        dc.style.animation = 'none';
        void dc.offsetWidth;
        dc.style.animation = '';
      }
    } else {
      dc.innerHTML = '';
      dc.style.background = 'rgba(255,255,255,.1)';
      dc.style.border = '2px dashed rgba(255,255,255,.4)';
      dc.style.borderRadius = '12px';
    }
    $('drawCard').innerHTML = cardBackSVG() + `<span class="draw-count">${s.drawCount} kart</span>`;
  }

  function renderHand(s, meInfo) {
    const handEl = $('hand');
    clearEl(handEl);
    const phase = s.phase;
    if (phase !== 'lobby' && meInfo && s.me) {
      const myTurn = s.me.myTurn && phase === 'playing';
      const hand = s.me.hand;
      const sorted = hand
        .map((v, i) => ({ v, i }))
        .sort((a, b) => rankOf(a.v) - rankOf(b.v));

      sorted.forEach(({ v, i }, idx) => {
        const div = document.createElement('div');
        div.className = 'card';
        if (phase === 'playing') div.classList.add('deal');
        if (phase === 'playing') div.style.animationDelay = idx * 55 + 'ms';
        div.innerHTML = cardSVG(v);
        const legal = myTurn && canPlay(v, s.discardTop);
        if (legal) {
          div.classList.add('legal');
          div.addEventListener('click', () => {
            if (div.classList.contains('played-anim')) return;
            div.classList.add('played-anim');
            playedAnimPending = true;
            sfx.playCard();
            setTimeout(() => socket.emit('play', { index: i }), 240);
          });
        }
        handEl.appendChild(div);
      });
      if (hand.length === 0 && phase === 'playing') {
        handEl.innerHTML = '<div class="ready-badge">🦙 Elini bitirdin!</div>';
      }
    } else if (phase === 'lobby') {
      handEl.innerHTML = '<div class="ready-badge">Oyuncular bekleniyor…</div>';
    }
  }

  function renderActions(s, meInfo) {
    const myTurn = s.phase === 'playing' && s.me && s.me.myTurn && meInfo && !meInfo.quit;
    $('drawBtn').disabled = !(myTurn && s.me.canDraw);
    $('quitBtn').disabled = !myTurn;
  }

  function renderLog(log) {
    const el = $('log');
    clearEl(el);
    for (const e of log.slice(-10).reverse()) {
      const div = document.createElement('div');
      div.className = 'entry';
      div.textContent = `Tur ${e.round} · ${e.msg}`;
      el.appendChild(div);
    }
  }

  function renderHint(s, meInfo) {
    const h = $('hint');
    if (s.phase === 'lobby') {
      h.textContent = 'Katılımcılar bekleniyor… (en az 2 kişi gerekli)';
      h.style.opacity = 1;
    } else if (s.phase === 'playing') {
      if (meInfo && s.me && s.me.myTurn) {
        h.innerHTML = '<b>👉 Sıra sende!</b> Aynı değer veya 1 üstünü oyna · kart çek · ya da çekil';
        h.style.opacity = 1;
      } else {
        const cp = s.players.find((p) => p.id === s.currentPlayerId);
        h.innerHTML = `⏳ Sıra: <b>${cp ? esc(cp.name) : '…'}</b>`;
        h.style.opacity = 1;
      }
    } else {
      h.textContent = s.phase === 'gameOver' ? '🏁 Oyun bitti!' : '🦙 Tur bitti';
      h.style.opacity = 0.9;
    }
  }

  function renderBanner(s) {
    const banner = $('banner');
    if (s.phase === 'roundEnd' || s.phase === 'gameOver') {
      banner.classList.remove('hidden');
      renderBannerContent(s);
    } else {
      banner.classList.add('hidden');
    }
  }

  function renderBannerContent(s) {
    const over = s.phase === 'gameOver';
    const winners = over ? s.winners : [];
    const sorted = s.players.slice().sort((a, b) => a.points - b.points);
    const meHost = s.hostId === me;

    const rows = sorted.map((p) => {
      const isWin = over && winners.includes(p.id);
      const finisher = s.finisherId === p.id && !over;
      const delta = p.roundScore != null ? '+' + p.roundScore : '';
      let cardsCell = '—';
      if (p.hand && p.hand.length) {
        cardsCell = `<div class="hand-mini">${p.hand.slice(0, 10).map((v) => `<div class="mini">${miniCardSVG(v)}</div>`).join('')}</div>`;
      }
      const returnNote = p.returned ? `<div class="banner-return">🔄 ${p.returned} puan jeton iade</div>` : '';
      return `<tr class="${isWin ? 'winner' : finisher ? 'finisher' : ''}">
        <td>${esc(p.name)}${p.id === me ? ' (sen)' : ''}</td>
        <td>${cardsCell}</td>
        <td class="num">${p.points}</td>
        <td class="delta">${finisher ? 'Elini bitirdi 🦙' : delta}${returnNote}</td>
      </tr>`;
    }).join('');

    let head, sub;
    if (over) {
      const wn = winners.length > 1 ? 'Berabere!' : esc(s.players.find((p) => p.id === winners[0])?.name || '') + ' kazandı!';
      head = `🏆 ${wn}`;
      sub = 'En az puanı olan kazanır. Tebrikler!';
    } else {
      head = `🦙 Tur ${s.round} bitti`;
      sub = 'Biri 40 puana ulaşınca oyun sona erer; en az puan kazanır. Elini bitiren 1 jeton iade eder.';
    }

    let action = '';
    if (over) {
      action = meHost
        ? '<button id="bannerAction" class="btn btn-primary">🔄 Yeni Oyun</button>'
        : '<p class="banner-timer">Yeni oyun için oda sahibini bekliyor…</p>';
    } else {
      action = meHost
        ? '<button id="bannerAction" class="btn btn-primary">▶ Sonraki Tura Başla</button>'
        : '<p class="banner-timer">Oda sahibi tura başlasın diye bekleniyor…</p>';
    }

    $('banner').innerHTML = `
      <div class="banner-box">
        <h2>${head}</h2>
        <div class="sub">${sub}</div>
        <table class="banner-table">
          <tr><th>Oyuncu</th><th>Eldeki kartlar</th><th>Puan</th><th>Tur</th></tr>
          ${rows}
        </table>
        ${action}
        <div class="banner-timer" id="bannerTimer"></div>
      </div>`;

    if (!over && s.phase === 'roundEnd') {
      const desc = $('bannerTimer');
      const deadline = Date.now() + 10000;
      const tick = () => {
        const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
        desc.textContent = meHost
          ? `10 saniye içinde otomatik başlar… (${left})`
          : `Yeni tur ${left} saniyede…`;
        if (left > 0) setTimeout(tick, 400);
      };
      tick();
    }

    const actBtn = $('bannerAction');
    if (actBtn) actBtn.addEventListener('click', () => {
      sfx.copy();
      actBtn.disabled = true;
      socket.emit(over ? 'newGame' : 'nextRound');
    });
  }

  /* ---------- flow ---------- */
  function showGame() {
    $('joinScreen').classList.add('hidden');
    $('gameScreen').classList.remove('hidden');
  }

  function attemptJoin() {
    const name = store.name() || $('nameInput').value.trim();
    const code = (store.room() || $('codeInput').value).trim().toUpperCase();
    const playerId = store.player();
    if (!name || !code) return;
    socket.emit('join', { code, name, playerId });
  }

  $('createBtn').addEventListener('click', () => {
    const name = $('nameInput').value.trim();
    if (!name) return showMsg('Lütfen bir ad gir.', false);
    localStorage.setItem('lama_name', name);
    sfx.copy();
    socket.emit('create', { name });
  });

  $('joinBtn').addEventListener('click', () => {
    const name = $('nameInput').value.trim();
    if (!name) return showMsg('Lütfen bir ad gir.', false);
    if (!$('codeInput').value.trim()) return showMsg('Oda kodu gir.', false);
    localStorage.setItem('lama_name', name);
    socket.emit('join', { code: $('codeInput').value.trim().toUpperCase(), name, playerId: store.player() });
  });

  $('roomChip').addEventListener('click', () => {
    if (!state) return;
    const code = state.code;
    sfx.copy();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => toast('Oda kodu kopyalandı: ' + code, true));
    } else {
      toast('Oda kodu: ' + code, true);
    }
  });

  $('soundBtn').addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem('lama_muted', muted ? '1' : '0');
    if (master) master.gain.value = muted ? 0 : 0.45;
    $('soundBtn').textContent = muted ? '🔇' : '🔊';
    if (!muted) sfx.playCard();
  });
  $('soundBtn').textContent = muted ? '🔇' : '🔊';

  $('drawBtn').addEventListener('click', () => {
    sfx.draw();
    socket.emit('draw');
  });
  $('quitBtn').addEventListener('click', () => {
    sfx.quit();
    socket.emit('quit');
  });

  socket.on('connect', () => {
    $('connDot').classList.add('ok');
    if (inGame) attemptJoin();
  });
  socket.on('connect_error', () => $('connDot').classList.remove('ok'));

  socket.on('joined', ({ code, playerId }) => {
    me = playerId;
    inGame = true;
    localStorage.setItem('lama_room', code);
    localStorage.setItem('lama_player', playerId);
    $('connDot').classList.add('ok');
  });

  socket.on('disconnect', () => {
    joined = false;
    $('connDot').classList.remove('ok');
    toast('Bağlantı koptu, yeniden bağlanılıyor…');
  });

  socket.on('state', (s) => {
    joined = true;
    inGame = true;
    showGame();
    render(s);
  });

  socket.on('error', ({ message }) => {
    sfx.error();
    if (!inGame) showMsg(message, false);
    toast(message);
  });

  if (store.room() && store.player() && store.name()) {
    $('nameInput').value = store.name();
    attemptJoin();
  }
})();
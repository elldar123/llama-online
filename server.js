const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Game } = require('./game');

const PORT = process.env.PORT || 3000;
const AUTO_NEXT_DELAY = 10000;
const AUTO_QUIT_DELAY = 60000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e5 });

const games = new Map();

function codeGen() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (games.has(code));
  return code;
}

function emitGame(game) {
  for (const p of game.players) {
    const sid = game.sockets[p.id];
    if (!sid) continue;
    const s = io.sockets.sockets.get(sid);
    if (s && s.connected) {
      s.emit('state', game.getStateFor(p.id));
    }
  }
}

function roomOf(socket) {
  const code = socket.data.gameCode;
  return code ? games.get(code) || null : null;
}

function hostSocketOf(game) {
  const sid = game.sockets[game.hostId];
  const s = sid ? io.sockets.sockets.get(sid) : null;
  return s && s.connected ? s : null;
}

function scheduleNextRound(game) {
  if (game._nextTimer) clearTimeout(game._nextTimer);
  game._nextTimer = setTimeout(() => {
    game._nextTimer = null;
    if (game.phase !== 'roundEnd') return;
    game.nextRound();
    emitGame(game);
  }, AUTO_NEXT_DELAY);
}

io.on('connection', (socket) => {
  socket.on('create', ({ name } = {}) => {
    const clean = String(name || 'Oyuncu').trim().slice(0, 16) || 'Oyuncu';
    const code = codeGen();
    const game = new Game(code);
    game.sockets = {};
    const res = game.addPlayer(clean);
    game.sockets[res.id] = socket.id;
    socket.data.gameCode = code;
    socket.data.playerId = res.id;
    socket.join(code);
    games.set(code, game);
    socket.emit('joined', { code, playerId: res.id });
    emitGame(game);
  });

  socket.on('join', ({ code, name, playerId } = {}) => {
    const cleanCode = String(code || '').trim().toUpperCase();
    const game = games.get(cleanCode);
    if (!game) return socket.emit('error', { message: 'Oda bulunamadi.' });

    if (playerId && game.player(playerId)) {
      const p = game.player(playerId);
      p.disconnected = false;
      game.sockets[playerId] = socket.id;
      socket.data.gameCode = cleanCode;
      socket.data.playerId = playerId;
      socket.join(cleanCode);
      game.logMsg(`${p.name} yeniden baglandi.`);
    } else {
      if (game.started) {
        return socket.emit('error', { message: 'Oyun basladi, artik katilinamaz.' });
      }
      const cleanName = String(name || 'Oyuncu').trim().slice(0, 16) || 'Oyuncu';
      const res = game.addPlayer(cleanName);
      if (!res.ok) return socket.emit('error', { message: res.error });
      game.sockets[res.id] = socket.id;
      socket.data.gameCode = cleanCode;
      socket.data.playerId = res.id;
      socket.join(cleanCode);
    }
    socket.emit('joined', { code: cleanCode, playerId: socket.data.playerId });
    emitGame(game);
  });

  const requireGame = (fn) => {
    const game = roomOf(socket);
    if (!game) return socket.emit('error', { message: 'Once bir odaya girin.' });
    return fn(game);
  };

  socket.on('start', () =>
    requireGame((game) => {
      if (socket.data.playerId !== game.hostId) return socket.emit('error', { message: 'Sadece oda sahibi baslatabilir.' });
      const res = game.start();
      if (!res.ok) return socket.emit('error', { message: res.error });
      emitGame(game);
    })
  );

  socket.on('play', (data) =>
    requireGame((game) => {
      const res = game.play(socket.data.playerId, Number(data && data.index));
      if (!res.ok) return socket.emit('error', { message: res.error });
      emitGame(game);
    })
  );

  socket.on('draw', () =>
    requireGame((game) => {
      const res = game.draw(socket.data.playerId);
      if (!res.ok) return socket.emit('error', { message: res.error });
      emitGame(game);
    })
  );

  socket.on('quit', () =>
    requireGame((game) => {
      const res = game.quit(socket.data.playerId);
      if (!res.ok) return socket.emit('error', { message: res.error });
      if (game.phase === 'roundEnd' || game.phase === 'gameOver') scheduleNextRound(game);
      emitGame(game);
    })
  );

  socket.on('nextRound', () =>
    requireGame((game) => {
      if (socket.data.playerId !== game.hostId) return socket.emit('error', { message: 'Sadece oda sahibi baslatabilir.' });
      if (game._nextTimer) {
        clearTimeout(game._nextTimer);
        game._nextTimer = null;
      }
      const res = game.nextRound();
      if (!res.ok) return socket.emit('error', { message: res.error });
      emitGame(game);
    })
  );

  socket.on('newGame', () =>
    requireGame((game) => {
      if (socket.data.playerId !== game.hostId) return socket.emit('error', { message: 'Sadece oda sahibi baslatabilir.' });
      const res = game.newGame();
      if (!res.ok) return socket.emit('error', { message: res.error });
      emitGame(game);
    })
  );

  socket.on('disconnect', () => {
    const game = roomOf(socket);
    if (!game) return;
    const pid = socket.data.playerId;
    const p = game.player(pid);
    if (!p) return;
    p.disconnected = true;

    if (game.hostId === pid) {
      const next = game.players.find((x) => x.id !== pid && !x.disconnected);
      if (next) {
        game.hostId = next.id;
        game.logMsg(`${next.name} oda sahibi oldu.`);
      }
    }

    if (game.phase === 'playing' && game.currentPlayer && game.currentPlayer.id === pid) {
      game._autoQuitTimer = setTimeout(() => {
        game._autoQuitTimer = null;
        const still = game.player(pid);
        if (still && still.disconnected && game.phase === 'playing' && game.currentPlayer && game.currentPlayer.id === pid) {
          const res = game.quit(pid);
          if (!res.ok) return;
          if (game.phase === 'roundEnd' || game.phase === 'gameOver') scheduleNextRound(game);
          emitGame(game);
        }
      }, AUTO_QUIT_DELAY);
    }

    const alive = game.players.some((x) => !x.disconnected);
    if (!alive) {
      game._killTimer = setTimeout(() => {
        if (games.get(game.code) === game) games.delete(game.code);
      }, 30 * 60 * 1000);
    }
    emitGame(game);
  });
});

server.listen(PORT, () => {
  console.log(`[L.L.A.M.A] canli oyun http://localhost:${PORT}`);
});
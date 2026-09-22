const VALUES = ['1', '2', '3', '4', '5', '6', 'LLAMA'];
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const GAME_OVER_AT = 40;
const HAND_SIZE = 6;

function rank(v) {
  return v === 'LLAMA' ? 7 : parseInt(v, 10);
}

function canPlay(card, top) {
  if (top == null) return true;
  const c = rank(card);
  const t = rank(top);
  return c === t || c === ((t % 7) + 1);
}

function createDeck() {
  const deck = [];
  for (const v of VALUES) {
    for (let i = 0; i < 8; i++) deck.push(v);
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handScore(hand) {
  const set = new Set(hand);
  let total = 0;
  for (const v of set) total += v === 'LLAMA' ? 10 : parseInt(v, 10);
  return total;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-2);
}

class Game {
  constructor(code) {
    this.code = code;
    this.players = [];
    this.hostId = null;
    this.started = false;
    this.phase = 'lobby';
    this.round = 0;
    this.current = -1;
    this.discard = [];
    this.drawPile = [];
    this.lastActionPlayerId = null;
    this.finisherId = null;
    this.log = [];
  }

  player(id) {
    return this.players.find((p) => p.id === id) || null;
  }

  logMsg(msg) {
    this.log.push({ t: Date.now(), msg, round: this.round });
    if (this.log.length > 30) this.log.splice(0, this.log.length - 30);
  }

  get activeCount() {
    return this.players.filter((p) => !p.quit).length;
  }

  get currentPlayer() {
    return this.players[this.current] || null;
  }

  addPlayer(name) {
    if (this.started) return { error: 'Oyun zaten basladi, katilimamaz.' };
    if (this.players.length >= MAX_PLAYERS) return { error: 'Oda dolu (maks 6).' };
    const id = makeId();
    this.players.push({
      id,
      name,
      hand: [],
      quit: false,
      points: 0,
      disconnected: false,
      roundScore: null,
      returned: null,
    });
    if (!this.hostId) this.hostId = id;
    this.logMsg(`${name} odaya katildi.`);
    return { ok: true, id };
  }

  startRound() {
    const deck = createDeck();
    this.discard = [];
    for (const p of this.players) {
      p.hand = [];
      p.quit = false;
      p.roundScore = null;
      p.returned = null;
    }
    for (let i = 0; i < HAND_SIZE; i++) {
      for (const p of this.players) p.hand.push(deck.pop());
    }
    this.discard.push(deck.pop());
    this.drawPile = deck;
    this.finisherId = null;
    const first = this.round === 0 && this.lastActionPlayerId === null;
    if (first) {
      this.current = Math.max(0, this.players.findIndex((p) => p.id === this.hostId));
    } else {
      const idx = this.players.findIndex((p) => p.id === this.lastActionPlayerId);
      this.current = idx >= 0 ? idx : 0;
    }
    this.round++;
    this.phase = 'playing';
  }

  start() {
    if (this.started) return { error: 'Oyun zaten basladi.' };
    if (this.players.length < MIN_PLAYERS) return { error: `En az ${MIN_PLAYERS} oyuncu gerekli.` };
    this.started = true;
    for (const p of this.players) p.points = 0;
    this.lastActionPlayerId = null;
    this.round = 0;
    this.startRound();
    this.logMsg('Oyun basladi. Bol sans!');
    return { ok: true };
  }

  play(playerId, index) {
    if (this.phase !== 'playing') return { error: 'Simdi oynanamaz.' };
    const p = this.player(playerId);
    if (!p) return { error: 'Oyuncu bulunamadi.' };
    if (this.currentPlayer.id !== playerId) return { error: 'Sira sizde degil.' };
    if (p.quit) return { error: 'Zaten turdan cekildiniz.' };
    const card = p.hand[index];
    if (card == null) return { error: 'Gecersiz kart secimi.' };
    const top = this.discard[this.discard.length - 1];
    if (!canPlay(card, top)) return { error: `${card} buraya oynanamaz (uyum: ayni veya 1 ust deger).` };
    p.hand.splice(index, 1);
    this.discard.push(card);
    this.lastActionPlayerId = playerId;
    this.logMsg(`${p.name}, ${card === 'LLAMA' ? 'LLAMA' : card} oynadi.`);
    if (p.hand.length === 0) {
      this.finishRound(playerId);
    } else {
      this.advanceTurn();
    }
    return { ok: true };
  }

  canDraw(playerId) {
    if (this.phase !== 'playing') return false;
    if (this.currentPlayer.id !== playerId) return false;
    const p = this.player(playerId);
    if (!p || p.quit) return false;
    if (this.drawPile.length === 0) return false;
    if (this.activeCount <= 1) return false;
    return true;
  }

  draw(playerId) {
    if (this.phase !== 'playing') return { error: 'Simdi cekilemez.' };
    const p = this.player(playerId);
    if (!p) return { error: 'Oyuncu bulunamadi.' };
    if (this.currentPlayer.id !== playerId) return { error: 'Sira sizde degil.' };
    if (p.quit) return { error: 'Zaten turdan cekildiniz.' };
    if (!this.canDraw(playerId)) {
      if (this.drawPile.length === 0) return { error: 'Cekme destesi bos.' };
      return { error: 'Tek kalan oyuncu kart cekemez.' };
    }
    p.hand.push(this.drawPile.pop());
    this.lastActionPlayerId = playerId;
    this.logMsg(`${p.name} kart cekti.`);
    this.advanceTurn();
    return { ok: true };
  }

  quit(playerId) {
    if (this.phase !== 'playing') return { error: 'Simdi cekilinemez.' };
    const p = this.player(playerId);
    if (!p) return { error: 'Oyuncu bulunamadi.' };
    if (this.currentPlayer.id !== playerId) return { error: 'Sira sizde degil.' };
    if (p.quit) return { error: 'Zaten cekildiniz.' };
    p.quit = true;
    this.lastActionPlayerId = playerId;
    this.logMsg(`${p.name} turdan cekildi.`);
    if (this.activeCount === 0) {
      this.finishRound(null);
    } else {
      this.advanceTurn();
    }
    return { ok: true };
  }

  advanceTurn() {
    const n = this.players.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.current + k) % n;
      if (!this.players[i].quit) {
        this.current = i;
        return;
      }
    }
    this.finishRound(null);
  }

  finishRound(finisherId) {
    this.finisherId = finisherId || null;
    if (finisherId) {
      const fp = this.player(finisherId);
      this.logMsg(`${fp.name} elini bitirdi! L.L.A.M.A!`);
    } else {
      this.logMsg('Herkes turdan cekildi. Tur sonu.');
    }
    for (const p of this.players) {
      const score = p.id === finisherId ? 0 : handScore(p.hand);
      p.roundScore = score;
      p.points += score;
      p.returned = null;
    }
    if (finisherId) {
      const fp = this.player(finisherId);
      const returned = fp.points >= 10 ? 10 : fp.points >= 1 ? 1 : 0;
      if (returned > 0) {
        fp.points -= returned;
        fp.returned = returned;
        this.logMsg(`${fp.name} ${returned} puanlik jeton iade etti.`);
      }
    }
    this.phase = 'roundEnd';
    if (this.players.some((p) => p.points >= GAME_OVER_AT)) {
      this.phase = 'gameOver';
      this.logMsg('Biri 40 puana ulasti. Oyun bitti!');
    }
  }

  nextRound() {
    if (this.phase !== 'roundEnd') return { error: 'Tur henuz bitmedi.' };
    this.startRound();
    return { ok: true };
  }

  newGame() {
    if (this.phase !== 'gameOver') return { error: 'Oyun bitmedi.' };
    for (const p of this.players) p.points = 0;
    this.started = true;
    this.lastActionPlayerId = null;
    this.round = 0;
    this.startRound();
    this.logMsg('Yeni oyun basladi!');
    return { ok: true };
  }

  winners() {
    if (this.phase !== 'gameOver') return [];
    const min = Math.min(...this.players.map((p) => p.points));
    return this.players.filter((p) => p.points === min);
  }

  canDrawFor(playerId) {
    return this.canDraw(playerId);
  }

  getStateFor(playerId) {
    const p = this.player(playerId);
    const isMyTurn = this.phase === 'playing' && this.currentPlayer && this.currentPlayer.id === playerId;
    return {
      code: this.code,
      phase: this.phase,
      round: this.round,
      hostId: this.hostId,
      currentPlayerId: this.phase === 'playing' && this.currentPlayer ? this.currentPlayer.id : null,
      discardTop: this.discard.length ? this.discard[this.discard.length - 1] : null,
      discardCount: this.discard.length,
      drawCount: this.drawPile.length,
      finisherId: this.finisherId,
      players: this.players.map((pp) => ({
        id: pp.id,
        name: pp.name,
        handSize: pp.hand.length,
        quit: pp.quit,
        points: pp.points,
        disconnected: pp.disconnected,
        isHost: pp.id === this.hostId,
        roundScore: pp.roundScore,
        returned: pp.returned,
        hand:
          this.phase === 'roundEnd' || this.phase === 'gameOver'
            ? pp.hand.slice()
            : null,
      })),
      me: p
        ? {
            myTurn: isMyTurn,
            canDraw: this.canDrawFor(playerId),
            hand: p.hand.slice(),
          }
        : null,
      log: this.log.slice(-8),
      winners: this.phase === 'gameOver' ? this.winners().map((w) => w.id) : [],
    };
  }
}

module.exports = { Game, canPlay, handScore, createDeck, VALUES, MAX_PLAYERS, MIN_PLAYERS, GAME_OVER_AT };
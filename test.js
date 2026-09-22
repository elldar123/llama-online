const assert = require('assert');
const { Game, canPlay, handScore, createDeck } = require('./game');

// canPlay rules
assert.strictEqual(canPlay('3', '3'), true);
assert.strictEqual(canPlay('4', '3'), true);
assert.strictEqual(canPlay('5', '3'), false);
assert.strictEqual(canPlay('1', '2'), false);
assert.strictEqual(canPlay('LLAMA', '6'), true);
assert.strictEqual(canPlay('LLAMA', 'LLAMA'), true);
assert.strictEqual(canPlay('1', 'LLAMA'), true);
assert.strictEqual(canPlay('1', '6'), false);
assert.strictEqual(canPlay('6', '6'), true);
assert.strictEqual(canPlay('1', '6'), false);
assert.strictEqual(canPlay(null, null), true);

// handScore - each value counted once, llama = 10 once
assert.strictEqual(handScore(['4', '4', '4', '4']), 4);
assert.strictEqual(handScore(['LLAMA', 'LLAMA']), 10);
assert.strictEqual(handScore(['1', '2', '3']), 6);
assert.strictEqual(handScore(['LLAMA', '1', '1']), 11);
assert.strictEqual(handScore([]), 0);

// deck
const deck = createDeck();
assert.strictEqual(deck.length, 56);
for (const v of ['1', '2', '3', '4', '5', '6', 'LLAMA']) {
  assert.strictEqual(deck.filter((c) => c === v).length, 8);
}

// full round simulation with 3 players
const g = new Game('TEST');
g.addPlayer('Ali');
g.addPlayer('Veli');
g.addPlayer('Selim');
assert.ok(g.start().ok);
assert.strictEqual(g.phase, 'playing');
assert.strictEqual(g.round, 1);
assert.strictEqual(g.players[0].hand.length, 6);
assert.strictEqual(g.discard.length, 1);
assert.strictEqual(g.drawPile.length, 56 - 18 - 1);

// simulate: keep playing until round ends
let guard = 0;
while (g.phase === 'playing' && guard++ < 2000) {
  const p = g.currentPlayer;
  if (p.quit) break;
  const top = g.discard[g.discard.length - 1];
  const idx = p.hand.findIndex((c) => canPlay(c, top));
  if (idx >= 0) {
    assert.ok(g.play(p.id, idx).ok);
  } else if (g.canDraw(p.id)) {
    assert.ok(g.draw(p.id).ok);
  } else {
    assert.ok(g.quit(p.id).ok);
  }
}
assert.strictEqual(g.phase, 'roundEnd');
assert.ok(g.players.every((p) => typeof p.points === 'number'));

// finisher returned a token (0 or 1 or 10) - just sanity
for (const p of g.players) assert.ok(p.points >= 0);

// next round starts, points persist
const before = g.players.map((p) => p.points);
assert.ok(g.nextRound().ok);
assert.strictEqual(g.round, 2);
assert.strictEqual(g.phase, 'playing');
g.players.forEach((p, i) => assert.strictEqual(p.points, before[i]));

// draw pile cannot be drawn when it runs out - skip, covered by canDraw false
// illegal play check
const g2 = new Game('T2');
g2.addPlayer('A');
g2.addPlayer('B');
g2.start();
const tp = g2.currentPlayer.id;
g2.discard = ['2'];
const badIdx = g2.player(tp).hand.indexOf('6');
if (badIdx >= 0) {
  const res = g2.play(tp, badIdx);
  assert.ok(!res.ok);
}

console.log('Tüm motor testleri geçti ✓');
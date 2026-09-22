(() => {
  "use strict";
  /* L.L.A.M.A CASINO - tiny self-contained (ASCII only) */
  const R = document.getElementById("casinoRoot");
  if (!R) return;
  /* ---- state ---- */
  let bank = parseInt(localStorage.getItem("ll_cash") || "500", 10) || 500;
  function saveB() { try { localStorage.setItem("ll_cash", String(bank)); } catch (e) {} }
  function setB(n) { bank = Math.max(0, n | 0); saveB(); }
  function cashEl() { return "<span class=\"cc-cash\">{" + bank + " altin}</span>"; }
  function h2(t) { return "<div class=\"cc-head\"><span class=\"cc-x\" data-x></span><div class=\"cc-logo\">" + t + "</div>" + cashEl() + "</div>"; }
  function btn(label, cls, fn) {
    const b = document.createElement("button");
    b.className = "cc-btn " + (cls || "");
    b.textContent = label;
    if (fn) b.onclick = fn;
    return b;
  }
  function elFrom(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html.trim();
    return tmp.firstChild;
  }
  let ov = null;
  function closeOv() { if (ov) { ov.remove(); ov = null; } q("ll").classList.remove("hidden"); }
  function showOv(html) {
    closeOv();
    ov = elFrom(html);
    ov.classList.add("cc-ov");
    document.body.appendChild(ov);
    const x = ov.querySelector("[data-x]");
    if (x) x.onclick = () => { closeOv(); lobby(); };
    return ov;
  }
  function ui(id, ovEl) { const n = ovEl.querySelector("#" + id); return n; }

  /* --- deck / cards --- */
  let deck = [];
  const SUIT = { H: "heart", C: "club", S: "spade", D: "diamond" };
  const SUITS = ["H", "C", "S", "D"];
  function cardSVG(c, face) {
    const v = c.v === 1 ? "A" : c.v === 10 ? "10" : c.v === 11 ? "J" : c.v === 12 ? "Q" : c.v === 13 ? "K" : String(c.v);
    const nameVal = c.v === 13 ? "kral" : c.v === 12 ? "kralice" : c.v === 11 ? "vale" : c.sym;
    const col = (c.s === "H" || c.s === "D") ? "#d33" : "#000";
    if (face === false) return "<svg class=\"cc-card\" viewBox=\"0 0 60 84\"><rect width=\"60\" height=\"84\" rx=\"6\" fill=\"#7a4a2b\"/><rect x=\"6\" y=\"6\" width=\"48\" height=\"72\" rx=\"4\" fill=\"none\" stroke=\"#e8c9a0\" stroke-width=\"2\"/><text x=\"30\" y=\"50\" text-anchor=\"middle\" font-size=\"26\">&#128023;</text></svg>";
    return "<svg class=\"cc-card\" viewBox=\"0 0 60 84\"><rect width=\"60\" height=\"84\" rx=\"6\" fill=\"#fff\"/><text x=\"8\" y=\"20\" font-size=\"22\" font-weight=\"800\" fill=\"" + col + "\">" + v + "</text><text x=\"30\" y=\"50\" text-anchor=\"middle\" font-size=\"26\">" + nameVal + "</text></svg>";
  }
  function cardBack() { return cardSVG({}, false); }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function newDeck() { const d = []; SUITS.forEach((s) => { for (let v = 1; v <= 13; v++) d.push({ s: s, v: v, sym: (s === "H" ? "heart" : s === "C" ? "club" : s === "S" ? "spade" : "diamond") }); }); return d; }

  /* --- lobby --- */
  function lobby() {
    const ov = showOv("<div class=\"cc-shell cc-lobby\">" +
      h2("L.L.A.M.A CASINO") +
      "<div class=\"cc-grid\">" +
        "<button class=\"cc-game\" data-g=\"bj\"><div class=\"cc-ic\">&#127183;</div><div><b>Blackjack</b><small>Dealer karsi</small></div></button>" +
        "<button class=\"cc-game\" data-g=\"ru\"><div class=\"cc-ic\">&#127922;</div><div><b>Rulet</b><small>Avrupa tek sifir</small></div></button>" +
        "<button class=\"cc-game\" data-g=\"sl\"><div class=\"cc-ic\">&#127915;</div><div><b>Slot</b><small>3 makara</small></div></button>" +
        "<button class=\"cc-game\" data-g=\"po\"><div class=\"cc-ic\">&#127136;</div><div><b>Poker</b><small>5 kart aci</small></div></button>" +
      "</div>" +
      "<div class=\"cc-foot\">Bakiye bu oturum boyunca kasa dahil ortaktir.</div>" +
    "</div>");
    ov.querySelectorAll(".cc-game").forEach((g) => {
      g.onclick = () => {
        const k = g.getAttribute("data-g");
        if (k === "bj") blackjack();
        else if (k === "ru") rulet();
        else if (k === "sl") slot();
        else if (k === "po") poker();
      };
    });
  }

  /* ============ BLACKJACK ============ */
  function val(h) { let s = 0; let a = 0; h.forEach((c) => { if (c.v === 1) { a++; s += 11; } else s += Math.min(c.v, 10); }); while (s > 21 && a) { s -= 10; a--; } return s; }
  function blackjack() {
    const ov = showOv("<div class=\"cc-shell cc-bj\">" +
      h2("Blackjack 21") +
      "<div class=\"cc-row\"><span class=\"cc-lbl\">Dealer</span><div class=\"cc-cards\" id=\"dCards\"></div><span class=\"cc-sc\" id=\"dSc\"></span></div>" +
      "<div class=\"cc-row\"><span class=\"cc-lbl\">Sen</span><div class=\"cc-cards\" id=\"mCards\"></div><span class=\"cc-sc\" id=\"mSc\"></span></div>" +
      "<div class=\"cc-msg\" id=\"msgbj\"></div>" +
      "<div class=\"cc-acts\" id=\"actsBj\"></div>" +
    "</div>");
    let d = shuffle(newDeck());
    let mine = [], dl = [], bet = 10;
    let over = false;

    function render(showAll) {
      ui("dCards", ov).innerHTML = dl.map((c, i) => cardSVG(c, over || showAll ? true : i === dl.length - 1 ? false : true)).join("");
      ui("mCards", ov).innerHTML = mine.map((c) => cardSVG(c, true)).join("");
      ui("dSc", ov).textContent = over || showAll ? String(val(dl)) : "?";
      ui("mSc", ov).textContent = String(val(mine));
    }
    function acts() {
      const a = ui("actsBj", ov);
      a.innerHTML = "";
      if (over) {
        const b = document.createElement("button"); b.className = "cc-btn"; b.textContent = "Yeni El";
        b.onclick = () => { if (bank < bet) { ui("msgbj", ov).textContent = "Bakiye yetmiyor."; return; } deal(); };
        a.appendChild(b);
        const h = document.createElement("button"); h.className = "cc-btn cc-x2"; h.textContent = "Menuye Don";
        h.onclick = () => { closeOv(); lobby(); };
        a.appendChild(h);
        return;
      }
      const hit = document.createElement("button"); hit.className = "cc-btn"; hit.textContent = "Kart Cek";
      hit.onclick = () => { mine.push(d.pop()); render(); if (val(mine) >= 21) settle(); else acts(); };
      const stay = document.createElement("button"); stay.className = "cc-btn"; stay.textContent = "Dur";
      stay.onclick = () => settle();
      a.appendChild(hit); a.appendChild(stay);
    }
    function settle() {
      over = true;
      while (val(dl) < 17) dl.push(d.pop());
      render(true);
      const m = val(mine), dv = val(dl);
      let msg2 = "";
      if (m > 21) msg2 = "Bust! -" + bet;
      else if (dv > 21) { bank += bet; msg2 = "Dealer bust! +" + bet; }
      else if (dv === m) msg2 = "Berabere";
      else if (m > dv) { bank += bet; msg2 = "Kazandin +" + bet; }
      else msg2 = "Dealer kazandi -" + bet;
      setB(bank);
      ov.querySelector(".cc-cash").innerHTML = cashEl2();
      ui("msgbj", ov).textContent = msg2;
      acts();
    }
    function cashEl2() { return "<span class=\"cc-cash\">{" + bank + " altin}</span>"; }
    function deal() {
      bank -= bet; setB(bank);
      ov.querySelector(".cc-cash").innerHTML = cashEl2();
      d = shuffle(newDeck());
      mine = [d.pop(), d.pop()];
      dl = [d.pop(), d.pop()];
      over = false;
      render(); acts();
      if (val(mine) === 21) settle();
    }
    deal();
  }

  /* ============ RULET ============ */
  function rulet() {
    const ov = showOv("<div class=\"cc-shell cc-ru\">" +
      h2("Avrupa Ruleti") +
      "<div class=\"cc-wheel\" id=\"wheel\"></div>" +
      "<div class=\"cc-bets\" id=\"bets\"></div>" +
      "<div class=\"cc-msg\" id=\"msgRu\"></div>" +
      "<div class=\"cc-acts\"><button class=\"cc-btn\" id=\"spinBtn\">Cevir</button><button class=\"cc-btn cc-x2\" id=\"ruBack\">Menuye Don</button></div>" +
    "</div>");
    const W = 38, Z = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    const REDS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const BLACKS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
    const isRed = (n) => REDS.indexOf(n) >= 0;
    const isBlack = (n) => BLACKS.indexOf(n) >= 0;
    let myBet = [];

    ui("ruBack", ov).onclick = () => { closeOv(); lobby(); };
    ui("spinBtn", ov).onclick = () => {
      if (!myBet.length) { ui("msgRu", ov).textContent = "Once bir bahis koy."; return; }
      const n = Z[(Math.random() * W) | 0];
      const col = n === 0 ? "yeIil" : (isRed(n) ? "kIRMIZI" : "SIYAH");
      let win = 0;
      myBet.forEach((b) => { if (b.w === "num" && b.n === n) win += b.a * 35; else if (b.w === "red" && isRed(n)) win += b.a * 2; else if (b.w === "black" && isBlack(n)) win += b.a * 2; else if (b.w === "even" && n !== 0 && n % 2 === 0) win += b.a * 2; else if (b.w === "odd" && n % 2 === 1) win += b.a * 2; });
      bank += win; setB(bank);
      const wStr = win > 0 ? " +" + win : "";
      ui("msgRu", ov).textContent = "Cikan: " + n + " " + col + wStr;
      ov.querySelector(".cc-cash").innerHTML = cashEl2();
      myBet = [];
      renderBets();
      // do again
      window.__ruSpin = window.__ruSpin || 0;
    };
    function renderBets() {
      ui("bets", ov).innerHTML = myBet.length ? myBet.map((b) => (b.w === "num" ? "Sayi " + b.n : b.w) + " x" + b.a).join(" ") : "Bahis sec (10 altin):";
    }
    function place(w, amt, n) {
      if (bank < amt) { ui("msgRu", ov).textContent = "Bakiye yetmiyor."; return; }
      bank -= amt; setB(bank);
      ov.querySelector(".cc-cash").innerHTML = cashEl2();
      myBet.push({ w: w, a: amt, n: n });
      renderBets();
    }
    // number pad
    const pad = ui("bets", ov);
    const grid = document.createElement("div"); grid.className = "cc-nums";
    Z.forEach((n) => {
      const b = document.createElement("button");
      b.className = "cc-num" + (isRed(n) ? " cc-red" : isBlack(n) ? " cc-black" : " cc-green");
      b.textContent = String(n);
      b.onclick = () => place("num", 10, n);
      grid.appendChild(b);
    });
    pad.appendChild(grid);
    const row2 = document.createElement("div"); row2.className = "cc-odds";
    [["red","KIRMIZI"],["black","SIYAH"],["even","CIFT"],["odd","TEK"]].forEach((p) => {
      const b = document.createElement("button"); b.className = "cc-btn cc-odd " + p[0]; b.textContent = p[1];
      b.onclick = () => place(p[0], 10);
      row2.appendChild(b);
    });
    pad.appendChild(row2);
    renderBets();
  }

  /* ============ SLOT ============ */
  function slot() {
    const ov = showOv("<div class=\"cc-shell cc-sl\">" +
      h2("Slot Makinesi") +
      "<div class=\"cc-reels\" id=\"reels\"><span class=\"cc-reel\">?</span><span class=\"cc-reel\">?</span><span class=\"cc-reel\">?</span></div>" +
      "<div class=\"cc-msg\" id=\"msgSl\"></div>" +
      "<div class=\"cc-acts\"><button class=\"cc-btn\" id=\"slBtn\">Cevir (10)</button><button class=\"cc-btn cc-x2\" id=\"slBack\">Menuye Don</button></div>" +
    "</div>");
    const SYM = ["LAMA", "LAMA", "KALP", "YILDIZ", "CIKOLATA", "LIRA", "ZAR"];
    const PAYS = { "LAMA": 100, "KALP": 20, "YILDIZ": 15, "CIKOLATA": 8, "LIRA": 5, "ZAR": 5 };
    ui("slBack", ov).onclick = () => { closeOv(); lobby(); };
    ui("slBtn", ov).onclick = () => {
      if (bank < 10) { ui("msgSl", ov).textContent = "Bakiye yetmiyor."; return; }
      bank -= 10; setB(bank);
      ov.querySelector(".cc-cash").innerHTML = cashEl2();
      const r = [0, 1, 2].map(() => SYM[(Math.random() * SYM.length) | 0]);
      const rr = ov.querySelectorAll(".cc-reel");
      rr.forEach((el, i) => (el.textContent = r[i]));
      let win = 0;
      const grp = {};
      r.forEach((x) => { grp[x] = (grp[x] || 0) + 1; });
      Object.keys(grp).forEach((k) => {
        if (grp[k] === 3) win = PAYS[k] || 50;
        else if (grp[k] === 2 && k !== "ZAR") win += 6;
      });
      if (win > 0) { bank += win; setB(bank); }
      ov.querySelector(".cc-cash").innerHTML = cashEl2();
      ui("msgSl", ov).textContent = (win > 0 ? "KAZANDIN +" + win : "Kaybettin.");
    };
  }

  /* ============ POKER (5-kart draw vs dealer) ============ */
  function rankH(h) {
    const vs = h.map((c) => c.v).sort((a, b) => b - a);
    let flush = h.every((c) => c.s === h[0].s);
    let straight = false;
    const uniq = vs.filter((v, i) => vs.indexOf(v) === i);
    if (uniq.length === 5) straight = (uniq[0] - uniq[4] === 4);
    const g = {};
    vs.forEach((v) => { g[v] = (g[v] || 0) + 1; });
    const groups = Object.keys(g).map((v) => [g[v], Number(v)]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    if (flush && straight) return 8;
    if (groups[0][0] === 4) return 7;
    if (groups[0][0] === 3 && groups[1][0] === 2) return 6;
    if (flush) return 5;
    if (straight) return 4;
    if (groups[0][0] === 3) return 3;
    if (groups[0][0] === 2 && groups[1][0] === 2) return 2;
    if (groups[0][0] === 2) return 1;
    return 0;
  }
  function cmpH(a, b) {
    const ra = rankH(a), rb = rankH(b);
    if (ra !== rb) return ra - rb;
    return 0;
  }
  function poker() {
    const ov = showOv("<div class=\"cc-shell cc-po\">" +
      h2("Poker Dealer") +
      "<div class=\"cc-row\"><span class=\"cc-lbl\">Dealer</span><div class=\"cc-cards\" id=\"pD\"></div><span class=\"cc-sc\" id=\"pDs\"></span></div>" +
      "<div class=\"cc-row\"><span class=\"cc-lbl\">Sen</span><div class=\"cc-cards\" id=\"pM\"></div><span class=\"cc-sc\" id=\"pMs\"></span></div>" +
      "<div class=\"cc-msg\" id=\"msgPo\"></div>" +
      "<div class=\"cc-acts\" id=\"actsPo\"></div>" +
    "</div>");
    const ST = ["RoyalFlush", "StraightFlush", "Four", "Full", "Flush", "Straight", "Three", "TwoPair", "Pair", "High"];
    const stName = (r) => ST[8 - r];
    let mine = [], dl = [], over = false, bet = 10;
    function deal() {
      const d = shuffle(newDeck());
      mine = d.splice(0, 5);
      dl = d.splice(0, 5);
      over = false;
      render(true);
      ui("actsPo", ov).innerHTML = "";
      const b = document.createElement("button"); b.className = "cc-btn"; b.textContent = "Bak"; b.onclick = () => settle();
      ui("actsPo", ov).appendChild(b);
      ui("msgPo", ov).textContent = "5 kart dagitildi. Dealer ile karsilastir (" + stName(rankH(dl)) + ").";
    }
    function render(showAll) {
      ui("pD", ov).innerHTML = dl.map((c) => cardSVG(c, true)).join("");
      ui("pM", ov).innerHTML = mine.map((c) => cardSVG(c, true)).join("");
      ui("pDs", ov).textContent = showAll ? stName(rankH(dl)) : "?";
      ui("pMs", ov).textContent = stName(rankH(mine));
    }
    function settle() {
      over = true;
      const r = cmpH(mine, dl);
      let m2 = "";
      if (r > 0) { bank += bet; m2 = "Kazandin +" + bet + " (" + stName(rankH(mine)) + ")"; }
      else if (r < 0) m2 = "Dealer kazandi (" + stName(rankH(dl)) + ")";
      else m2 = "Berabere";
      setB(bank);
      ov.querySelector(".cc-cash").innerHTML = cashEl2();
      ui("msgPo", ov).textContent = m2;
      ui("actsPo", ov).innerHTML = "";
      const b = document.createElement("button"); b.className = "cc-btn"; b.textContent = "Yeni El";
      b.onclick = () => { if (bank < bet) { ui("msgPo", ov).textContent = "Bakiye yetmiyor."; return; } deal(); };
      const h2 = document.createElement("button"); h2.className = "cc-btn cc-x2"; h2.textContent = "Menuye Don";
      h2.onclick = () => { closeOv(); lobby(); };
      ui("actsPo", ov).appendChild(b); ui("actsPo", ov).appendChild(h2);
    }
    if (bank < bet) { ui("msgPo", ov).textContent = "Bakiye yetmiyor."; return; }
    bank -= bet; setB(bank);
    ov.querySelector(".cc-cash").innerHTML = cashEl2();
    deal();
  }

  /* -- bootstrap -- */
  const b = document.getElementById("casinoBtn");
  if (b) b.onclick = () => { const j = document.getElementById("joinScreen"); if (j) j.classList.add("hidden"); lobby(); };
  if (window.__autoCasino) { const j = document.getElementById("joinScreen"); if (j) j.classList.add("hidden"); lobby(); }
})();
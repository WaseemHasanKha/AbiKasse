/* ═══════════════════════════════════════════
   STATE & STORAGE
═══════════════════════════════════════════ */
const STATE = {
  produkte: [],
  verkaufe: [],
  einnahmen: [],
  kassenbuch: [],
  cart: []
};

function save() {
  localStorage.setItem('abikasse', JSON.stringify(STATE));
}

function load() {
  const d = localStorage.getItem('abikasse');
  if (d) {
    const parsed = JSON.parse(d);
    Object.assign(STATE, parsed);
  }
}

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
function eur(n) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function nowStr() {
  return new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function toast(msg, error = false) {
  const t = document.getElementById('toast');
  const m = document.getElementById('toastMsg');
  m.textContent = msg;
  t.classList.toggle('error', error);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function showModal(id) { document.getElementById(id).classList.add('open'); }
function hideModal(id) { document.getElementById(id).classList.remove('open'); }

/* ═══════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════ */
const pageTitles = {
  dashboard: 'Dashboard',
  produkte: 'Produkte',
  kasse: 'Kasse',
  einnahmen: 'Andere Einnahmen',
  kassenstand: 'Kassenstand',
  historie: 'Verlauf'
};

function goTo(page) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  document.getElementById('pageTitle').textContent = pageTitles[page] || page;

  if (page === 'dashboard')    renderDashboard();
  if (page === 'produkte')     renderProduktTable();
  if (page === 'kasse')        renderKasseGrid();
  if (page === 'einnahmen')    renderEinnahmen();
  if (page === 'kassenstand')  renderKassenstand();
  if (page === 'historie')     renderHistorie();

  // close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');
}

document.querySelectorAll('.nav-link').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); goTo(l.dataset.page); });
});

document.querySelectorAll('.link-btn').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); goTo(l.dataset.page); });
});

/* ═══════════════════════════════════════════
   SIDEBAR TOGGLE
═══════════════════════════════════════════ */
document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

document.getElementById('mobileMenuBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('mobile-open');
});

/* ═══════════════════════════════════════════
   DATE
═══════════════════════════════════════════ */
document.getElementById('currentDate').textContent =
  new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

/* ═══════════════════════════════════════════
   TOTALS (sidebar + dashboard stats)
═══════════════════════════════════════════ */
function calcTotals() {
  const verkaufEinnahmen = STATE.verkaufe.reduce((s, v) => s + v.gesamt, 0);
  const verkaufGewinn    = STATE.verkaufe.reduce((s, v) => s + v.gewinn, 0);
  const sonstige         = STATE.einnahmen.reduce((s, e) => s + e.betrag, 0);
  const einlagen         = STATE.kassenbuch.filter(k => k.typ === 'einlage').reduce((s, k) => s + k.betrag, 0);
  const entnahmen        = STATE.kassenbuch.filter(k => k.typ === 'entnahme').reduce((s, k) => s + k.betrag, 0);
  const kassenstand      = verkaufEinnahmen + sonstige + einlagen - entnahmen;
  const gesamtgewinn     = verkaufGewinn + sonstige;

  return { verkaufEinnahmen, verkaufGewinn, sonstige, einlagen, entnahmen, kassenstand, gesamtgewinn };
}

function updateSidebarTotal() {
  const { gesamtgewinn } = calcTotals();
  document.getElementById('sidebarTotal').textContent = eur(gesamtgewinn);
}

/* ═══════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════ */
let chartInstance = null;

function renderDashboard() {
  const { verkaufEinnahmen, sonstige, kassenstand, gesamtgewinn } = calcTotals();

  document.getElementById('dash-gesamtgewinn').textContent = eur(gesamtgewinn);
  document.getElementById('dash-verkauf').textContent      = eur(verkaufEinnahmen);
  document.getElementById('dash-sonstige').textContent     = eur(sonstige);
  document.getElementById('dash-kassenstand').textContent  = eur(kassenstand);

  renderLowStock();
  renderRecentSales();
  renderChart();
  updateSidebarTotal();
}

function renderLowStock() {
  const list = document.getElementById('lowStockList');
  const low  = STATE.produkte.filter(p => p.bestand <= 5);
  if (!low.length) {
    list.innerHTML = '<div class="empty-state"><i class="fa fa-check-circle"></i><p>Alles gut bestückt!</p></div>';
    return;
  }
  list.innerHTML = low.map(p => `
    <div class="low-stock-item">
      <span class="name">${p.name}</span>
      <span class="count">${p.bestand} übrig</span>
    </div>`).join('');
}

function renderRecentSales() {
  const tbody = document.getElementById('recentSalesBody');
  const recent = [...STATE.verkaufe].reverse().slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Noch keine Verkäufe</td></tr>';
    return;
  }
  tbody.innerHTML = recent.map(v => `
    <tr>
      <td class="mono" style="font-size:0.78rem;color:var(--text-muted)">${v.zeit}</td>
      <td>${v.items.map(i => i.name).join(', ')}</td>
      <td class="mono">${v.items.reduce((s,i) => s + i.menge, 0)}</td>
      <td class="mono" style="color:var(--blue)">${eur(v.gesamt)}</td>
      <td class="mono" style="color:var(--green)">${eur(v.gewinn)}</td>
    </tr>`).join('');
}

function renderChart() {
  const canvas = document.getElementById('einnahmenChart');
  const empty  = document.getElementById('chartEmpty');

  if (!STATE.verkaufe.length && !STATE.einnahmen.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // group by day
  const map = {};
  [...STATE.verkaufe].forEach(v => {
    const day = v.zeit.split(',')[0];
    map[day] = (map[day] || 0) + v.gesamt;
  });
  [...STATE.einnahmen].forEach(e => {
    const day = e.datum;
    map[day] = (map[day] || 0) + e.betrag;
  });

  const labels = Object.keys(map).slice(-10);
  const values = labels.map(l => map[l]);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Einnahmen (€)',
        data: values,
        borderColor: '#f5c542',
        backgroundColor: 'rgba(245,197,66,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#f5c542',
        pointRadius: 4,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#7b85a0', font: { size: 10 } }, grid: { color: '#2a314822' } },
        y: { ticks: { color: '#7b85a0', font: { size: 10 }, callback: v => v + ' €' }, grid: { color: '#2a314844' } }
      }
    }
  });
}

/* ═══════════════════════════════════════════
   PRODUKTE
═══════════════════════════════════════════ */

// live gewinn preview
['prod-einkauf','prod-verkauf'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    const ek = parseFloat(document.getElementById('prod-einkauf').value) || 0;
    const vk = parseFloat(document.getElementById('prod-verkauf').value) || 0;
    const g  = vk - ek;
    const el = document.getElementById('gewinnProStueck');
    el.textContent = eur(g);
    el.style.color = g >= 0 ? 'var(--green)' : 'var(--red)';
  });
});

document.getElementById('addProduktBtn').addEventListener('click', () => {
  const name      = document.getElementById('prod-name').value.trim();
  const einkauf   = parseFloat(document.getElementById('prod-einkauf').value);
  const verkauf   = parseFloat(document.getElementById('prod-verkauf').value);
  const menge     = parseInt(document.getElementById('prod-menge').value);
  const kategorie = document.getElementById('prod-kategorie').value.trim() || 'Sonstiges';

  if (!name || isNaN(einkauf) || isNaN(verkauf) || isNaN(menge)) {
    toast('Bitte alle Felder ausfüllen!', true); return;
  }

  STATE.produkte.push({ id: uid(), name, einkauf, verkauf, menge, bestand: menge, kategorie });
  save();
  renderProduktTable();
  toast('Produkt hinzugefügt ✓');

  // reset
  ['prod-name','prod-einkauf','prod-verkauf','prod-menge','prod-kategorie'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('gewinnProStueck').textContent = '— €';
});

function renderProduktTable(filter = '') {
  const tbody = document.getElementById('produktTableBody');
  let list = STATE.produkte;
  if (filter) list = list.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Noch keine Produkte</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(p => {
    const gewinn = p.verkauf - p.einkauf;
    const potGewinn = gewinn * p.bestand;
    const stockColor = p.bestand <= 5 ? 'var(--red)' : p.bestand <= 10 ? 'var(--orange)' : 'var(--green)';
    return `<tr>
      <td><strong>${p.name}</strong></td>
      <td><span class="badge badge-blue">${p.kategorie}</span></td>
      <td class="mono">${eur(p.einkauf)}</td>
      <td class="mono">${eur(p.verkauf)}</td>
      <td class="mono" style="color:${gewinn>=0?'var(--green)':'var(--red)'}">${eur(gewinn)}</td>
      <td class="mono" style="color:${stockColor};font-weight:700">${p.bestand}</td>
      <td class="mono" style="color:var(--purple)">${eur(potGewinn)}</td>
      <td>
        <button class="action-btn" onclick="openBestandModal('${p.id}')"><i class="fa fa-pen"></i> Bestand</button>
        <button class="action-btn danger" onclick="deleteProdukt('${p.id}')"><i class="fa fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

document.getElementById('produktSearch').addEventListener('input', e => renderProduktTable(e.target.value));

// Bestand Modal
let bestandTarget = null;

function openBestandModal(id) {
  const p = STATE.produkte.find(x => x.id === id);
  if (!p) return;
  bestandTarget = id;
  document.getElementById('bestandModalName').textContent = p.name;
  document.getElementById('bestandModalMenge').value = p.bestand;
  showModal('bestandModal');
}

document.getElementById('bestandModalSave').addEventListener('click', () => {
  const val = parseInt(document.getElementById('bestandModalMenge').value);
  if (isNaN(val) || val < 0) { toast('Ungültige Menge!', true); return; }
  const p = STATE.produkte.find(x => x.id === bestandTarget);
  if (p) { p.bestand = val; save(); renderProduktTable(); toast('Bestand aktualisiert ✓'); }
  hideModal('bestandModal');
});

document.getElementById('bestandModalClose').addEventListener('click', () => hideModal('bestandModal'));
document.getElementById('bestandModalCancel').addEventListener('click', () => hideModal('bestandModal'));

function deleteProdukt(id) {
  if (!confirm('Produkt wirklich löschen?')) return;
  STATE.produkte = STATE.produkte.filter(p => p.id !== id);
  save();
  renderProduktTable();
  toast('Produkt gelöscht');
}

/* ═══════════════════════════════════════════
   KASSE
═══════════════════════════════════════════ */
function renderKasseGrid(filter = '') {
  const grid = document.getElementById('kasseProduktGrid');
  let list = STATE.produkte;
  if (filter) list = list.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

  if (!list.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fa fa-box-open"></i><p>Erst Produkte anlegen</p></div>';
    return;
  }

  grid.innerHTML = list.map(p => `
    <button class="produkt-btn" onclick="addToCart('${p.id}')" ${p.bestand <= 0 ? 'disabled' : ''}>
      <span class="p-name">${p.name}</span>
      <span class="p-price">${eur(p.verkauf)}</span>
      <span class="p-stock">${p.bestand <= 0 ? '❌ Ausverkauft' : p.bestand + ' übrig'}</span>
    </button>`).join('');
}

document.getElementById('kasseSearch').addEventListener('input', e => renderKasseGrid(e.target.value));

function addToCart(id) {
  const p = STATE.produkte.find(x => x.id === id);
  if (!p || p.bestand <= 0) return;
  const existing = STATE.cart.find(c => c.id === id);
  if (existing) {
    if (existing.menge >= p.bestand) { toast('Nicht genug auf Lager!', true); return; }
    existing.menge++;
  } else {
    STATE.cart.push({ id, name: p.name, preis: p.verkauf, einkauf: p.einkauf, menge: 1 });
  }
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const empty     = document.getElementById('cartEmpty');

  if (!STATE.cart.length) {
    container.innerHTML = '';
    container.appendChild(empty);
    empty.style.display = 'flex';
    updateCartTotals();
    document.getElementById('verkaufAbschliessenBtn').disabled = true;
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = STATE.cart.map(c => `
    <div class="cart-item">
      <span class="cart-item-name">${c.name}</span>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQty('${c.id}', -1)">−</button>
        <span class="qty-num">${c.menge}</span>
        <button class="qty-btn" onclick="changeQty('${c.id}', 1)">+</button>
      </div>
      <span class="cart-item-price">${eur(c.preis * c.menge)}</span>
      <button class="remove-btn" onclick="removeFromCart('${c.id}')"><i class="fa fa-xmark"></i></button>
    </div>`).join('');

  updateCartTotals();
  document.getElementById('verkaufAbschliessenBtn').disabled = false;
}

function changeQty(id, delta) {
  const item = STATE.cart.find(c => c.id === id);
  const prod = STATE.produkte.find(p => p.id === id);
  if (!item || !prod) return;
  item.menge += delta;
  if (item.menge > prod.bestand) { item.menge = prod.bestand; toast('Nicht genug auf Lager!', true); }
  if (item.menge <= 0) STATE.cart = STATE.cart.filter(c => c.id !== id);
  renderCart();
}

function removeFromCart(id) {
  STATE.cart = STATE.cart.filter(c => c.id !== id);
  renderCart();
}

function updateCartTotals() {
  const gesamt = STATE.cart.reduce((s, c) => s + c.preis * c.menge, 0);
  const gewinn = STATE.cart.reduce((s, c) => s + (c.preis - c.einkauf) * c.menge, 0);
  document.getElementById('cartSubtotal').textContent = eur(gesamt);
  document.getElementById('cartTotal').textContent    = eur(gesamt);
  document.getElementById('cartProfit').textContent   = eur(gewinn);
  updateRueckgeld();
}

document.getElementById('gegeben').addEventListener('input', updateRueckgeld);

function updateRueckgeld() {
  const gesamt  = STATE.cart.reduce((s, c) => s + c.preis * c.menge, 0);
  const gegeben = parseFloat(document.getElementById('gegeben').value) || 0;
  const rueck   = gegeben - gesamt;
  const el      = document.getElementById('rueckgeld');
  if (gegeben > 0) {
    el.textContent = eur(rueck);
    el.style.color = rueck >= 0 ? 'var(--green)' : 'var(--red)';
  } else {
    el.textContent = '—';
    el.style.color = 'var(--green)';
  }
}

document.getElementById('clearCartBtn').addEventListener('click', () => {
  STATE.cart = [];
  renderCart();
});

document.getElementById('verkaufAbschliessenBtn').addEventListener('click', () => {
  if (!STATE.cart.length) return;
  const gesamt = STATE.cart.reduce((s, c) => s + c.preis * c.menge, 0);
  const gewinn = STATE.cart.reduce((s, c) => s + (c.preis - c.einkauf) * c.menge, 0);

  const verkauf = {
    id: uid(),
    zeit: nowStr(),
    items: STATE.cart.map(c => ({ id: c.id, name: c.name, menge: c.menge, preis: c.preis })),
    gesamt,
    gewinn,
    typ: 'verkauf'
  };

  // reduce stock
  STATE.cart.forEach(c => {
    const p = STATE.produkte.find(x => x.id === c.id);
    if (p) p.bestand -= c.menge;
  });

  STATE.verkaufe.push(verkauf);
  STATE.cart = [];
  save();
  renderCart();
  renderKasseGrid();
  updateSidebarTotal();
  toast(`Verkauf über ${eur(gesamt)} abgeschlossen ✓`);
  document.getElementById('gegeben').value = '';
});

/* ═══════════════════════════════════════════
   ANDERE EINNAHMEN
═══════════════════════════════════════════ */
document.getElementById('ein-datum').value = new Date().toISOString().split('T')[0];

document.getElementById('addEinnahmeBtn').addEventListener('click', () => {
  const beschreibung = document.getElementById('ein-beschreibung').value.trim();
  const betrag       = parseFloat(document.getElementById('ein-betrag').value);
  const kategorie    = document.getElementById('ein-kategorie').value;
  const datum        = document.getElementById('ein-datum').value;
  const notiz        = document.getElementById('ein-notiz').value.trim();

  if (!beschreibung || isNaN(betrag) || betrag <= 0) {
    toast('Bitte Beschreibung und Betrag angeben!', true); return;
  }

  STATE.einnahmen.push({ id: uid(), beschreibung, betrag, kategorie, datum, notiz, typ: 'einnahme', zeit: nowStr() });
  save();
  renderEinnahmen();
  updateSidebarTotal();
  toast('Einnahme hinzugefügt ✓');

  document.getElementById('ein-beschreibung').value = '';
  document.getElementById('ein-betrag').value = '';
  document.getElementById('ein-notiz').value = '';
});

function renderEinnahmen() {
  const tbody = document.getElementById('einnahmenTableBody');
  const list  = [...STATE.einnahmen].reverse();

  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Noch keine Einnahmen</td></tr>';
  } else {
    tbody.innerHTML = list.map(e => `
      <tr>
        <td class="mono" style="font-size:0.78rem;color:var(--text-muted)">${e.datum}</td>
        <td><strong>${e.beschreibung}</strong></td>
        <td><span class="badge badge-purple">${e.kategorie}</span></td>
        <td class="mono" style="color:var(--green)">${eur(e.betrag)}</td>
        <td style="color:var(--text-muted);font-size:0.82rem">${e.notiz || '—'}</td>
        <td><button class="action-btn danger" onclick="deleteEinnahme('${e.id}')"><i class="fa fa-trash"></i></button></td>
      </tr>`).join('');
  }

  // Kategorie Karten
  const kategorien = {};
  STATE.einnahmen.forEach(e => { kategorien[e.kategorie] = (kategorien[e.kategorie] || 0) + e.betrag; });
  const colors = ['badge-green','badge-blue','badge-purple','badge-orange','badge-red'];
  const container = document.getElementById('einnahmenKategorien');
  const keys = Object.keys(kategorien);

  if (keys.length) {
    container.innerHTML = keys.map((k, i) => `
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-label">${k}</span>
          <span class="stat-value mono" style="color:var(--purple)">${eur(kategorien[k])}</span>
        </div>
      </div>`).join('');
  } else {
    container.innerHTML = '';
  }
}

function deleteEinnahme(id) {
  STATE.einnahmen = STATE.einnahmen.filter(e => e.id !== id);
  save();
  renderEinnahmen();
  updateSidebarTotal();
  toast('Einnahme gelöscht');
}

/* ═══════════════════════════════════════════
   KASSENSTAND
═══════════════════════════════════════════ */
document.getElementById('addBewegungBtn').addEventListener('click', () => {
  const typ    = document.getElementById('bewegung-typ').value;
  const betrag = parseFloat(document.getElementById('bewegung-betrag').value);
  const grund  = document.getElementById('bewegung-grund').value.trim();

  if (isNaN(betrag) || betrag <= 0) { toast('Betrag eingeben!', true); return; }

  const { kassenstand } = calcTotals();
  const saldo = typ === 'einlage' ? kassenstand + betrag : kassenstand - betrag;

  STATE.kassenbuch.push({ id: uid(), typ, betrag, grund: grund || '—', zeit: nowStr(), saldo });
  save();
  renderKassenstand();
  updateSidebarTotal();
  toast('Gebucht ✓');

  document.getElementById('bewegung-betrag').value = '';
  document.getElementById('bewegung-grund').value = '';
});

function renderKassenstand() {
  const { verkaufEinnahmen, sonstige, entnahmen, kassenstand } = calcTotals();

  document.getElementById('kassenstandBetrag').textContent = eur(kassenstand);
  document.getElementById('ks-verkauf').textContent        = eur(verkaufEinnahmen);
  document.getElementById('ks-sonstige').textContent       = eur(sonstige);
  document.getElementById('ks-entnahmen').textContent      = eur(entnahmen);

  const tbody = document.getElementById('kassenbuchBody');
  const list  = [...STATE.kassenbuch].reverse();

  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Keine Bewegungen</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(k => `
    <tr>
      <td class="mono" style="font-size:0.78rem;color:var(--text-muted)">${k.zeit}</td>
      <td><span class="badge ${k.typ === 'einlage' ? 'badge-green' : 'badge-red'}">${k.typ === 'einlage' ? '↑ Einlage' : '↓ Entnahme'}</span></td>
      <td class="mono" style="color:${k.typ === 'einlage' ? 'var(--green)' : 'var(--red)'}">${k.typ === 'entnahme' ? '−' : '+'}${eur(k.betrag)}</td>
      <td>${k.grund}</td>
      <td class="mono" style="color:var(--accent)">${eur(k.saldo)}</td>
    </tr>`).join('');
}

/* ═══════════════════════════════════════════
   VERLAUF / HISTORIE
═══════════════════════════════════════════ */
let historieFilter = 'alle';

document.getElementById('historieFilter').addEventListener('click', e => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  historieFilter = tab.dataset.filter;
  renderHistorie();
});

let deleteTarget = null;

function renderHistorie() {
  const tbody = document.getElementById('historieTableBody');

  const verkaufe  = STATE.verkaufe.map(v  => ({ ...v, _typ: 'verkauf' }));
  const einnahmen = STATE.einnahmen.map(e => ({ ...e, _typ: 'einnahme' }));
  const kassenbuch = STATE.kassenbuch.map(k => ({ ...k, _typ: 'kassenbuch' }));

  let all = [...verkaufe, ...einnahmen, ...kassenbuch]
    .sort((a, b) => new Date(b.zeit?.split(',').reverse().join(' ') || 0) - new Date(a.zeit?.split(',').reverse().join(' ') || 0));

  if (historieFilter !== 'alle') all = all.filter(x => x._typ === historieFilter);

  if (!all.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Noch keine Einträge</td></tr>';
    return;
  }

  tbody.innerHTML = all.map(x => {
    let typBadge, beschreibung, betrag, gewinn, canDelete;

    if (x._typ === 'verkauf') {
      typBadge    = '<span class="badge badge-blue">Verkauf</span>';
      beschreibung = x.items.map(i => `${i.name} ×${i.menge}`).join(', ');
      betrag       = `<span class="mono" style="color:var(--blue)">${eur(x.gesamt)}</span>`;
      gewinn       = `<span class="mono" style="color:var(--green)">${eur(x.gewinn)}</span>`;
      canDelete    = true;
    } else if (x._typ === 'einnahme') {
      typBadge    = `<span class="badge badge-purple">${x.kategorie}</span>`;
      beschreibung = x.beschreibung;
      betrag       = `<span class="mono" style="color:var(--purple)">${eur(x.betrag)}</span>`;
      gewinn       = '—';
      canDelete    = true;
    } else {
      typBadge    = `<span class="badge ${x.typ === 'einlage' ? 'badge-green' : 'badge-red'}">${x.typ === 'einlage' ? 'Einlage' : 'Entnahme'}</span>`;
      beschreibung = x.grund;
      betrag       = `<span class="mono" style="color:${x.typ === 'einlage' ? 'var(--green)' : 'var(--red)'}">${eur(x.betrag)}</span>`;
      gewinn       = '—';
      canDelete    = false;
    }

    return `<tr>
      <td class="mono" style="font-size:0.78rem;color:var(--text-muted)">${x.zeit || x.datum || '—'}</td>
      <td>${typBadge}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${beschreibung}</td>
      <td>${betrag}</td>
      <td>${gewinn}</td>
      <td>${canDelete ? `<button class="action-btn danger" onclick="openDeleteModal('${x.id}','${x._typ}')"><i class="fa fa-rotate-left"></i></button>` : ''}</td>
    </tr>`;
  }).join('');
}

function openDeleteModal(id, typ) {
  deleteTarget = { id, typ };
  showModal('rueckgaengigModal');
}

document.getElementById('rueckgaengigConfirm').addEventListener('click', () => {
  if (!deleteTarget) return;
  const { id, typ } = deleteTarget;

  if (typ === 'verkauf') {
    const v = STATE.verkaufe.find(x => x.id === id);
    if (v) {
      // restore stock
      v.items.forEach(i => {
        const p = STATE.produkte.find(x => x.id === i.id);
        if (p) p.bestand += i.menge;
      });
      STATE.verkaufe = STATE.verkaufe.filter(x => x.id !== id);
    }
  } else if (typ === 'einnahme') {
    STATE.einnahmen = STATE.einnahmen.filter(x => x.id !== id);
  }

  save();
  renderHistorie();
  updateSidebarTotal();
  hideModal('rueckgaengigModal');
  toast('Eintrag gelöscht & Bestand wiederhergestellt');
  deleteTarget = null;
});

document.getElementById('rueckgaengigCancel').addEventListener('click', () => hideModal('rueckgaengigModal'));
document.getElementById('rueckgaengigModalClose').addEventListener('click', () => hideModal('rueckgaengigModal'));

/* ═══════════════════════════════════════════
   CSV EXPORT
═══════════════════════════════════════════ */
document.getElementById('exportBtn').addEventListener('click', () => {
  const rows = [['Zeit','Typ','Beschreibung','Betrag (€)','Gewinn (€)']];

  STATE.verkaufe.forEach(v => {
    rows.push([v.zeit, 'Verkauf', v.items.map(i => `${i.name} x${i.menge}`).join(' | '), v.gesamt.toFixed(2), v.gewinn.toFixed(2)]);
  });
  STATE.einnahmen.forEach(e => {
    rows.push([e.datum, e.kategorie, e.beschreibung, e.betrag.toFixed(2), '']);
  });
  STATE.kassenbuch.forEach(k => {
    rows.push([k.zeit, k.typ, k.grund, k.betrag.toFixed(2), '']);
  });

  const csv     = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
  const blob    = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `abikasse_export_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportiert ✓');
});

/* ═══════════════════════════════════════════
   CHART.JS laden
═══════════════════════════════════════════ */
const chartScript = document.createElement('script');
chartScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
chartScript.onload = () => init();
document.head.appendChild(chartScript);

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
function init() {
  load();
  renderDashboard();
}
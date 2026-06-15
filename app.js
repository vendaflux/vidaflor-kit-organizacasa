/* ════════════════════════════════════════════════════════════════
   Kit Casa Organizada · VidaFlor — APP
   Persistência local (localStorage), edição inline, checkboxes,
   rotina dinâmica, navegação, instalar/exportar/importar e SW.
   Não altera o conteúdo das páginas; apenas as ativa.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORE_KEY = 'vidaflor.kit-casa.v1';

  /* ---------- estado ---------- */
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      s.fields = s.fields || {};
      s.checks = s.checks || {};
      s.routine = s.routine || {};
      return s;
    } catch (e) {
      return { fields: {}, checks: {}, routine: {} };
    }
  }
  var state = load();

  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(commit, 250);
  }
  function commit() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      flashSaved();
    } catch (e) {
      console.warn('Falha ao salvar:', e);
    }
  }

  /* ---------- índice estável de páginas ---------- */
  var pages = [].slice.call(document.querySelectorAll('.page'));
  pages.forEach(function (p, i) { p.dataset.pi = i; });
  function pageIndex(el) {
    var p = el.closest('.page');
    return p ? p.dataset.pi : 'x';
  }

  /* ---------- campos de texto editáveis ---------- */
  /* line:true  -> ganha área de toque maior (.vf-line)
     always:true -> editável mesmo já tendo texto (campos com "___")
     cond        -> predicado opcional para ativar */
  var FIELDS = [
    { t: 'ln',     s: '.bln .ln',              line: true },
    { t: 'dl',     s: '.day-line .dl',         line: true },
    { t: 'taskTx', s: '.day .task .tx',        line: true },
    { t: 'taskMin',s: '.day .task .min' },
    { t: 'meal',   s: '.meal-line' },
    { t: 'il',     s: '.ingr-line .il',        line: true },
    { t: 'rl',     s: '.rs-line .rl',          line: true },
    { t: 'finL',   s: '.fin-row .fl',          line: true },
    { t: 'finV',   s: '.fin-row .fv',          line: true },
    { t: 'cf',     s: '.contact-card .cf',     line: true },
    { t: 'docv',   s: '.doc-row .dr-v',        line: true },
    { t: 'obs',    s: '.maint-card .obs',      line: true },
    { t: 'bbl',    s: '.base-blank .bbl',      line: true },
    { t: 'ebl',    s: '.essential-blank .ebl', line: true },
    { t: 'btx',    s: '.base-item .btx',       line: true },
    { t: 'metas',  s: '.metas-semana .ms-line',line: true },
    { t: 'detox',  s: '.detox-table tbody td:nth-child(2)' },
    { t: 'cc',     s: '.cc-table tbody tr:not(.cc-wk) td:nth-child(-n+3)' },
    { t: 'dt',     s: '.maint-card .dt',       always: true },
    { t: 'tot',    s: '.bday .tot',            always: true },
    { t: 'saldo',  s: '.fin-saldo strong',     always: true },
    { t: 'pill',   s: '.day .dh .pill',        always: true, cond: function (el) { return el.textContent.indexOf('_') !== -1; } }
  ];

  function setupFields() {
    FIELDS.forEach(function (cfg) {
      var counters = {};
      [].slice.call(document.querySelectorAll(cfg.s)).forEach(function (el) {
        if (el.dataset.vfBound) return;
        var hasText = el.textContent.trim() !== '';
        if (!cfg.always && hasText) return;        // rótulo fixo: não editar
        if (cfg.cond && !cfg.cond(el)) return;      // condicional

        var pi = pageIndex(el);
        var n = (counters[pi] || 0); counters[pi] = n + 1;
        var key = 't:' + pi + ':' + cfg.t + ':' + n;

        el.dataset.vfKey = key;
        el.dataset.vfBound = '1';
        el.classList.add('vf-edit');
        if (cfg.line) el.classList.add('vf-line');
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');

        if (Object.prototype.hasOwnProperty.call(state.fields, key)) {
          el.textContent = state.fields[key];
        }

        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
        el.addEventListener('input', function () {
          var v = el.innerText.replace(/\s+/g, ' ').trim();
          if (v === '') delete state.fields[key]; else state.fields[key] = v;
          scheduleSave();
        });
      });
    });
  }

  /* ---------- checkboxes (.cbx e .hcbx) ---------- */
  function setupChecks() {
    [['cbx', '.cbx'], ['hcbx', '.hcbx']].forEach(function (pair) {
      var type = pair[0], sel = pair[1];
      var counters = {};
      [].slice.call(document.querySelectorAll(sel)).forEach(function (el) {
        if (el.dataset.vfBound) return;
        var pi = pageIndex(el);
        var n = (counters[pi] || 0); counters[pi] = n + 1;
        var key = 'c:' + pi + ':' + type + ':' + n;

        el.dataset.vfKey = key;
        el.dataset.vfBound = '1';
        el.setAttribute('role', 'checkbox');
        el.setAttribute('tabindex', '0');

        var on = !!state.checks[key];
        el.classList.toggle('is-checked', on);
        el.setAttribute('aria-checked', on ? 'true' : 'false');

        function toggle() {
          var checked = el.classList.toggle('is-checked');
          el.setAttribute('aria-checked', checked ? 'true' : 'false');
          if (checked) state.checks[key] = 1; else delete state.checks[key];
          scheduleSave();
        }
        el.addEventListener('click', toggle);
        el.addEventListener('keydown', function (e) {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
        });
      });
    });
  }

  /* ---------- input estático (nome da receita) ---------- */
  function setupStaticInputs() {
    [].slice.call(document.querySelectorAll('.rs-inp')).forEach(function (el, i) {
      var pi = pageIndex(el);
      var key = 'i:' + pi + ':rs:' + i;
      if (Object.prototype.hasOwnProperty.call(state.fields, key)) el.value = state.fields[key];
      el.addEventListener('input', function () {
        if (el.value === '') delete state.fields[key]; else state.fields[key] = el.value;
        scheduleSave();
      });
    });
  }

  /* ---------- Rotina do dia (itens dinâmicos por turno) ---------- */
  var turnos = [].slice.call(document.querySelectorAll('.turno'));
  turnos.forEach(function (t, i) { t.dataset.rid = i; });

  function makeRitem(h, x) {
    var row = document.createElement('div');
    row.className = 'ritem';
    row.innerHTML =
      '<input class="hr-in" type="time">' +
      '<input class="tx-in" type="text" placeholder="adicione sua tarefa...">' +
      '<button class="btn-rm-rt" type="button" aria-label="Remover">×</button>';
    if (h) row.querySelector('.hr-in').value = h;
    if (x) row.querySelector('.tx-in').value = x;
    return row;
  }

  function serializeTurno(turno) {
    if (!turno) return;
    var arr = [];
    [].slice.call(turno.querySelectorAll('.ritem')).forEach(function (r) {
      var h = r.querySelector('.hr-in'), x = r.querySelector('.tx-in');
      var hv = h ? h.value : '', xv = x ? x.value : '';
      if (hv !== '' || xv !== '') arr.push([hv, xv]);
    });
    var rid = turno.dataset.rid;
    if (arr.length) state.routine[rid] = arr; else delete state.routine[rid];
    scheduleSave();
  }

  function rebuildTurno(turno, arr) {
    var addBtn = turno.querySelector('.add-rt');
    [].slice.call(turno.querySelectorAll('.ritem')).forEach(function (r) { r.remove(); });
    arr.forEach(function (it) { turno.insertBefore(makeRitem(it[0], it[1]), addBtn); });
    turno.insertBefore(makeRitem('', ''), addBtn); // sempre uma linha livre
  }

  function addRotina(arg) {
    var turno = (arg && arg.closest) ? arg.closest('.turno') : arg;
    if (!turno) return;
    var addBtn = turno.querySelector('.add-rt');
    var row = makeRitem('', '');
    turno.insertBefore(row, addBtn);
    var tx = row.querySelector('.tx-in'); if (tx) tx.focus();
    serializeTurno(turno);
  }
  window.addRotina = addRotina; // compatível com chamadas inline remanescentes

  function setupRoutine() {
    // neutraliza os onclick inline e centraliza tudo na delegação
    [].slice.call(document.querySelectorAll('.btn-rm-rt[onclick]')).forEach(function (b) { b.removeAttribute('onclick'); });
    [].slice.call(document.querySelectorAll('.add-rt button[onclick]')).forEach(function (b) { b.removeAttribute('onclick'); });

    turnos.forEach(function (t) {
      var rid = t.dataset.rid;
      if (state.routine[rid]) rebuildTurno(t, state.routine[rid]);
    });

    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.classList && (el.classList.contains('hr-in') || el.classList.contains('tx-in'))) {
        serializeTurno(el.closest('.turno'));
      }
    });
    document.addEventListener('click', function (e) {
      var rm = e.target.closest && e.target.closest('.btn-rm-rt');
      if (rm) {
        var row = rm.closest('.ritem'), turno = rm.closest('.turno');
        if (row) row.remove();
        serializeTurno(turno);
        return;
      }
      var addb = e.target.closest && e.target.closest('.add-rt');
      if (addb) { addRotina(addb); }
    });
  }

  /* ---------- tabelas largas: rolagem horizontal no celular ---------- */
  function wrapTables() {
    ['.meal-table', '.cc-table', '.detox-table', '.habit-table'].forEach(function (sel) {
      [].slice.call(document.querySelectorAll(sel)).forEach(function (tb) {
        if (tb.parentElement && tb.parentElement.classList.contains('vf-scroll')) return;
        var w = document.createElement('div');
        w.className = 'vf-scroll';
        tb.parentNode.insertBefore(w, tb);
        w.appendChild(tb);
      });
    });
  }

  /* ---------- UI: toolbar, drawer, dropdown ---------- */
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function buildUI() {
    var header = document.createElement('header');
    header.className = 'vf-bar no-print';
    header.innerHTML =
      '<button class="vf-iconbtn" id="vfMenuBtn" aria-label="Seções">☰</button>' +
      '<div class="vf-title">Casa Organizada<small>VidaFlor · com propósito</small></div>' +
      '<span class="vf-saved" id="vfSaved">✓ salvo</span>' +
      '<div class="vf-menu-wrap">' +
        '<button class="vf-iconbtn" id="vfDots" aria-label="Ações">⋯</button>' +
        '<div class="vf-dropdown" id="vfDropdown">' +
          '<button id="vfInstall"><span class="mi">⬇️</span> Instalar app</button>' +
          '<button id="vfPrint"><span class="mi">🖨️</span> Imprimir / Salvar PDF</button>' +
          '<hr>' +
          '<button id="vfExport"><span class="mi">📤</span> Exportar dados (backup)</button>' +
          '<button id="vfImport"><span class="mi">📥</span> Importar dados</button>' +
          '<hr>' +
          '<button id="vfReset" class="danger"><span class="mi">🗑️</span> Limpar tudo</button>' +
        '</div>' +
      '</div>';

    var iosHint = document.createElement('div');
    iosHint.className = 'vf-ios-hint no-print';
    iosHint.id = 'vfIosHint';
    iosHint.innerHTML =
      'Para instalar no iPhone/iPad: toque em <b>Compartilhar</b> (o ícone de seta) e depois em ' +
      '<b>"Adicionar à Tela de Início"</b>. O app abre em tela cheia e funciona offline.' +
      '<br><button id="vfIosClose">entendi</button>';

    var scrim = document.createElement('div');
    scrim.className = 'vf-scrim no-print';
    scrim.id = 'vfScrim';

    var drawer = document.createElement('aside');
    drawer.className = 'vf-drawer no-print';
    drawer.id = 'vfDrawer';
    drawer.innerHTML =
      '<div class="dh"><div class="et">Kit Casa Organizada</div><h3>Seções 🌸</h3></div>' +
      '<ul class="vf-navlist" id="vfNavList"></ul>';

    document.body.insertBefore(header, document.body.firstChild);
    document.body.insertBefore(iosHint, header.nextSibling);
    document.body.appendChild(scrim);
    document.body.appendChild(drawer);

    wireUI();
    buildNav();
  }

  function buildNav() {
    var list = document.getElementById('vfNavList');
    pages.forEach(function (p, i) {
      if (!p.id) p.id = 'pg-' + i;
      var eb = p.querySelector('.eyebrow');
      var ttl = p.querySelector('h1, h2, h3');
      var label = ttl ? ttl.textContent.replace(/\s+/g, ' ').trim() : ('Página ' + (i + 1));
      var sub = eb ? eb.textContent.replace(/\s+/g, ' ').trim() : '';

      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + p.id;
      a.innerHTML =
        '<span class="nidx">' + (i === 0 ? '🌸' : i) + '</span>' +
        '<span>' +
          (sub ? '<small style="display:block;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--rose);font-weight:800">' + sub + '</small>' : '') +
          label +
        '</span>';
      a.addEventListener('click', function (e) {
        e.preventDefault();
        closeDrawer();
        var target = document.getElementById(p.id);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  var deferredPrompt = null;

  function wireUI() {
    var scrim = document.getElementById('vfScrim');
    var drawer = document.getElementById('vfDrawer');
    var menuBtn = document.getElementById('vfMenuBtn');
    var dots = document.getElementById('vfDots');
    var dropdown = document.getElementById('vfDropdown');

    menuBtn.addEventListener('click', openDrawer);
    scrim.addEventListener('click', closeDrawer);

    dots.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target) && e.target !== dots) dropdown.classList.remove('open');
    });

    document.getElementById('vfPrint').addEventListener('click', function () {
      dropdown.classList.remove('open');
      window.print();
    });
    document.getElementById('vfExport').addEventListener('click', function () {
      dropdown.classList.remove('open');
      exportData();
    });
    document.getElementById('vfImport').addEventListener('click', function () {
      dropdown.classList.remove('open');
      importData();
    });
    document.getElementById('vfReset').addEventListener('click', function () {
      dropdown.classList.remove('open');
      resetData();
    });

    // Instalar
    var installBtn = document.getElementById('vfInstall');
    var iosHint = document.getElementById('vfIosHint');
    document.getElementById('vfIosClose').addEventListener('click', function () {
      iosHint.classList.remove('show');
    });

    if (isStandalone()) {
      installBtn.style.display = 'none';
    } else if (isIOS()) {
      installBtn.style.display = ''; // ao tocar, mostra instrução iOS
    } else {
      installBtn.style.display = 'none'; // só aparece quando o navegador permitir
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (!isStandalone()) installBtn.style.display = '';
    });

    installBtn.addEventListener('click', function () {
      dropdown.classList.remove('open');
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          installBtn.style.display = 'none';
        });
      } else if (isIOS()) {
        iosHint.classList.add('show');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    window.addEventListener('appinstalled', function () {
      installBtn.style.display = 'none';
    });
  }

  function openDrawer() {
    document.getElementById('vfScrim').classList.add('open');
    document.getElementById('vfDrawer').classList.add('open');
  }
  function closeDrawer() {
    document.getElementById('vfScrim').classList.remove('open');
    document.getElementById('vfDrawer').classList.remove('open');
  }

  /* ---------- backup / restore / reset ---------- */
  function exportData() {
    try {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      var d = new Date().toISOString().slice(0, 10);
      a.href = URL.createObjectURL(blob);
      a.download = 'casa-organizada-' + d + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    } catch (e) {
      alert('Não foi possível exportar agora.');
    }
  }

  function importData() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.addEventListener('change', function () {
      var file = inp.files && inp.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(reader.result);
          if (!obj || typeof obj !== 'object') throw new Error('formato');
          obj.fields = obj.fields || {};
          obj.checks = obj.checks || {};
          obj.routine = obj.routine || {};
          if (!confirm('Importar este backup vai substituir os dados atuais. Continuar?')) return;
          localStorage.setItem(STORE_KEY, JSON.stringify(obj));
          location.reload();
        } catch (e) {
          alert('Arquivo inválido. Selecione um backup exportado por este app.');
        }
      };
      reader.readAsText(file);
    });
    inp.click();
  }

  function resetData() {
    if (!confirm('Isso apaga tudo que você preencheu (marcações, textos e rotina) neste aparelho. Tem certeza?')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    location.reload();
  }

  /* ---------- indicador "salvo" ---------- */
  var savedTimer = null;
  function flashSaved() {
    var el = document.getElementById('vfSaved');
    if (!el) return;
    el.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { el.classList.remove('show'); }, 1200);
  }

  /* ---------- service worker ---------- */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function (e) {
        console.warn('SW não registrado:', e);
      });
    }
  }

  /* ---------- init ---------- */
  function init() {
    setupFields();
    setupChecks();
    setupStaticInputs();
    setupRoutine();
    wrapTables();
    buildUI();
    registerSW();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

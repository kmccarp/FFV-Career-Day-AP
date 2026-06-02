'use strict';
(function () {
  var STORAGE_KEY = 'ffv-career-day-tracker-v1';
  var IMG_BASE = '../'; // images live in the repo's /images, one level up from /android
  var data = window.TRACKER_DATA;

  // ---- state ---------------------------------------------------------------
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt/unavailable storage */ }
    return {};
  }

  var saveTimer = null;
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      flashSaved();
    } catch (e) {
      var el = document.getElementById('saveState');
      if (el) { el.textContent = 'Not saved'; el.style.color = '#d9434e'; }
    }
  }

  function flashSaved() {
    var el = document.getElementById('saveState');
    if (!el) return;
    el.textContent = 'Saved';
    el.classList.add('flash');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { el.classList.remove('flash'); }, 600);
  }

  // ---- rendering -----------------------------------------------------------
  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function makeImg(src) {
    var img = el('img');
    img.src = IMG_BASE + src;
    img.alt = '';
    return img;
  }

  function section(title, gridClass) {
    var sec = el('section', 'section');
    var h = el('h3'); h.textContent = title;
    var grid = el('div', 'grid ' + gridClass);
    sec.appendChild(h);
    sec.appendChild(grid);
    return { sec: sec, grid: grid };
  }

  function renderToggleCell(grid, item, opts) {
    opts = opts || {};
    var on = !!state[item.code];
    var cell = el('div', 'cell ' + (on ? 'on' : 'off'), {
      'data-code': item.code,
      'role': 'button',
      'tabindex': '0',
      'aria-pressed': on ? 'true' : 'false',
      'title': item.name,
      'aria-label': item.name
    });
    cell.appendChild(makeImg(item.img));
    if (opts.badge && on) {
      var b = el('span', 'check');
      b.style.backgroundImage = 'url(' + IMG_BASE + opts.badge + ')';
      cell.appendChild(b);
    }
    cell.addEventListener('click', function () {
      state[item.code] = !state[item.code];
      if (!state[item.code]) delete state[item.code];
      refreshToggleCell(cell, item, opts);
      save();
    });
    cell.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cell.click(); }
    });
    grid.appendChild(cell);
  }

  function refreshToggleCell(cell, item, opts) {
    var on = !!state[item.code];
    cell.className = 'cell ' + (on ? 'on' : 'off');
    cell.setAttribute('aria-pressed', on ? 'true' : 'false');
    var existing = cell.querySelector('.check');
    if (existing) cell.removeChild(existing);
    if (opts && opts.badge && on) {
      var b = el('span', 'check');
      b.style.backgroundImage = 'url(' + IMG_BASE + opts.badge + ')';
      cell.appendChild(b);
    }
  }

  function renderCounterCell(grid, item) {
    var val = state[item.code] || 0;
    var cell = el('div', 'cell events-cell ' + (val > 0 ? 'on' : 'off'), {
      'data-code': item.code,
      'role': 'button',
      'tabindex': '0',
      'title': item.name + ' (tap to add, long-press to subtract)',
      'aria-label': item.name + ', ' + val + ' of ' + item.max
    });
    cell.appendChild(makeImg(item.img));
    var badge = el('span', 'count');
    badge.textContent = val + '/' + item.max;
    cell.appendChild(badge);

    function setVal(v) {
      v = Math.max(0, Math.min(item.max, v));
      if (v === 0) delete state[item.code]; else state[item.code] = v;
      cell.className = 'cell events-cell ' + (v > 0 ? 'on' : 'off');
      badge.textContent = v + '/' + item.max;
      cell.setAttribute('aria-label', item.name + ', ' + v + ' of ' + item.max);
      save();
    }
    cell.addEventListener('click', function () { setVal((state[item.code] || 0) + 1); });
    // long-press / right-click to decrement
    var lpTimer = null, longPressed = false;
    cell.addEventListener('contextmenu', function (e) { e.preventDefault(); setVal((state[item.code] || 0) - 1); });
    cell.addEventListener('touchstart', function () {
      longPressed = false;
      lpTimer = setTimeout(function () { longPressed = true; setVal((state[item.code] || 0) - 1); }, 450);
    }, { passive: true });
    cell.addEventListener('touchend', function (e) {
      clearTimeout(lpTimer);
      if (longPressed) { e.preventDefault(); }
    });
    cell.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setVal((state[item.code] || 0) + 1); }
      else if (ev.key === 'ArrowDown' || ev.key === '-') { ev.preventDefault(); setVal((state[item.code] || 0) - 1); }
    });
    grid.appendChild(cell);
  }

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = '';

    var items = section('Key Items', 'items');
    data.keyItems.forEach(function (row) {
      row.forEach(function (it) { renderToggleCell(items.grid, it); });
    });
    app.appendChild(items.sec);

    var jobs = section('Jobs', 'jobs');
    data.jobs.forEach(function (row) {
      row.forEach(function (j) { renderToggleCell(jobs.grid, j); });
    });
    app.appendChild(jobs.sec);

    var bosses = section('Bosses', 'bosses');
    data.bosses.forEach(function (row) {
      row.forEach(function (b) {
        renderToggleCell(bosses.grid, b, { badge: 'images/bosses/check.png' });
      });
    });
    app.appendChild(bosses.sec);

    var events = section('Events', 'events');
    data.events.forEach(function (e) {
      if (e.type === 'counter') renderCounterCell(events.grid, e);
      else renderToggleCell(events.grid, e);
    });
    app.appendChild(events.sec);
  }

  // ---- clear flow ----------------------------------------------------------
  function openConfirm() { document.getElementById('confirmOverlay').hidden = false; }
  function closeConfirm() { document.getElementById('confirmOverlay').hidden = true; }
  function doClear() {
    state = {};
    save();
    render();
    closeConfirm();
  }

  // ---- boot ----------------------------------------------------------------
  function init() {
    render();
    document.getElementById('clearBtn').addEventListener('click', openConfirm);
    document.getElementById('confirmCancel').addEventListener('click', closeConfirm);
    document.getElementById('confirmClear').addEventListener('click', doClear);
    document.getElementById('confirmOverlay').addEventListener('click', function (e) {
      if (e.target === this) closeConfirm();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeConfirm();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache optional */ });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

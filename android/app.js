'use strict';
(function () {
  var STORAGE_KEY = 'ffv-career-day-tracker-v1';
  var IMG_BASE = '../'; // images live in the repo's /images, one level up from /android
  var LONG_PRESS_MS = 450;
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

  // ---- helpers -------------------------------------------------------------
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

  // Unify tap vs long-press across mouse and touch via pointer events.
  // A long press fires onLongPress and suppresses the subsequent tap.
  function attachPress(node, onTap, onLongPress, keyLong) {
    var timer = null, longFired = false;
    function start() {
      longFired = false;
      if (!onLongPress) return;
      timer = setTimeout(function () { longFired = true; onLongPress(); }, LONG_PRESS_MS);
    }
    function cancel() { clearTimeout(timer); timer = null; }
    node.addEventListener('pointerdown', start);
    node.addEventListener('pointerup', cancel);
    node.addEventListener('pointerleave', cancel);
    node.addEventListener('pointercancel', cancel);
    node.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    node.addEventListener('click', function (e) {
      if (longFired) { e.preventDefault(); e.stopPropagation(); longFired = false; return; }
      if (onTap) onTap();
    });
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (onTap) onTap(); }
      else if (keyLong && (e.key === 'i' || e.key === 'ArrowUp') && onLongPress) { e.preventDefault(); onLongPress(); }
    });
  }

  function section(title, gridClass) {
    var sec = el('section', 'section');
    var h = el('h3'); h.textContent = title;
    var grid = el('div', 'grid ' + gridClass);
    sec.appendChild(h);
    sec.appendChild(grid);
    return { sec: sec, grid: grid };
  }

  // ---- info popup ----------------------------------------------------------
  function showInfo(item) {
    document.getElementById('infoImg').src = IMG_BASE + item.img;
    document.getElementById('infoTitle').textContent = item.name;
    document.getElementById('infoKind').textContent = item.kind || '';
    var body = document.getElementById('infoBody');
    body.innerHTML = '';
    if (item.location) {
      var label = el('span', 'info-label');
      label.textContent = item.kind === 'Boss' ? 'Vanilla location' : 'Where';
      body.appendChild(label);
      body.appendChild(document.createTextNode(item.location));
    } else if (item.unlocks) {
      var ul = el('span', 'info-label');
      ul.textContent = 'Unlocks';
      body.appendChild(ul);
      body.appendChild(document.createTextNode(item.unlocks));
    } else {
      body.textContent = item.name;
    }
    document.getElementById('infoOverlay').hidden = false;
  }
  function closeInfo() { document.getElementById('infoOverlay').hidden = true; }

  // ---- toggle cells --------------------------------------------------------
  function renderToggleCell(grid, item, opts) {
    opts = opts || {};
    var on = !!state[item.code];
    var cell = el('div', 'cell ' + (on ? 'on' : 'off'), {
      'data-code': item.code,
      'role': 'button',
      'tabindex': '0',
      'aria-pressed': on ? 'true' : 'false',
      'title': item.name + (item.location ? ' — ' + item.location : (item.unlocks ? ' — ' + item.unlocks : '')),
      'aria-label': item.name
    });
    cell.appendChild(makeImg(item.img));
    applyBadge(cell, item, opts);

    attachPress(cell, function () {
      state[item.code] = !state[item.code];
      if (!state[item.code]) delete state[item.code];
      var nowOn = !!state[item.code];
      cell.className = 'cell ' + (nowOn ? 'on' : 'off');
      cell.setAttribute('aria-pressed', nowOn ? 'true' : 'false');
      applyBadge(cell, item, opts);
      save();
    }, function () { showInfo(item); }, true);

    grid.appendChild(cell);
  }

  function applyBadge(cell, item, opts) {
    var existing = cell.querySelector('.check');
    if (existing) cell.removeChild(existing);
    if (opts.badge && state[item.code]) {
      var b = el('span', 'check');
      b.style.backgroundImage = 'url(' + IMG_BASE + opts.badge + ')';
      cell.appendChild(b);
    }
  }

  // ---- counter cell --------------------------------------------------------
  function renderCounterCell(grid, item) {
    var cell = el('div', 'cell events-cell ' + ((state[item.code] || 0) > 0 ? 'on' : 'off'), {
      'data-code': item.code,
      'role': 'button',
      'tabindex': '0',
      'title': item.name + ' (tap +1, long-press -1)',
      'aria-label': item.name
    });
    cell.appendChild(makeImg(item.img));
    var badge = el('span', 'count');
    cell.appendChild(badge);

    function paint() {
      var v = state[item.code] || 0;
      cell.className = 'cell events-cell ' + (v > 0 ? 'on' : 'off');
      badge.textContent = v + '/' + item.max;
      cell.setAttribute('aria-label', item.name + ', ' + v + ' of ' + item.max);
    }
    function setVal(v) {
      v = Math.max(0, Math.min(item.max, v));
      if (v === 0) delete state[item.code]; else state[item.code] = v;
      paint();
      save();
    }
    // tap increments; going past the max wraps back to 0
    function bump() {
      var cur = state[item.code] || 0;
      setVal(cur >= item.max ? 0 : cur + 1);
    }
    function lower() { setVal((state[item.code] || 0) - 1); }

    paint();
    attachPress(cell, bump, lower, false);
    // keyboard: ArrowDown / minus to subtract (ArrowUp is taken by long-press helper)
    cell.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === '-') { e.preventDefault(); lower(); }
    });
    grid.appendChild(cell);
  }

  // ---- render --------------------------------------------------------------
  function render() {
    var app = document.getElementById('app');
    app.innerHTML = '';

    var items = section('Key Items', 'items');
    data.keyItems.forEach(function (row) { row.forEach(function (it) { renderToggleCell(items.grid, it); }); });
    app.appendChild(items.sec);

    var jobs = section('Jobs', 'jobs');
    data.jobs.forEach(function (row) { row.forEach(function (j) { renderToggleCell(jobs.grid, j); }); });
    app.appendChild(jobs.sec);

    var bosses = section('Bosses', 'bosses');
    data.bosses.forEach(function (row) {
      row.forEach(function (b) { renderToggleCell(bosses.grid, b, { badge: 'images/bosses/check.png' }); });
    });
    app.appendChild(bosses.sec);

    var events = section('Events', 'events');
    data.events.forEach(function (e) {
      if (e.type === 'counter') renderCounterCell(events.grid, e);
      else renderToggleCell(events.grid, e, e.kind === 'Boss' ? { badge: 'images/bosses/check.png' } : {});
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
    document.getElementById('confirmOverlay').addEventListener('click', function (e) { if (e.target === this) closeConfirm(); });
    document.getElementById('infoClose').addEventListener('click', closeInfo);
    document.getElementById('infoOverlay').addEventListener('click', function (e) { if (e.target === this) closeInfo(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeConfirm(); closeInfo(); }
    });

    if ('serviceWorker' in navigator) {
      // when a new service worker takes over (new deploy), reload once to show it
      var hadController = !!navigator.serviceWorker.controller;
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing || !hadController) return;
        refreshing = true;
        window.location.reload();
      });
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then(function (reg) { reg.update(); })
        .catch(function () { /* offline cache optional */ });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

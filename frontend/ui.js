// UI helpers — kept backwards-compatible with views.* imports
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (v === false || v == null) return;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'html') {
      node.innerHTML = v;
    } else if (k === 'ref' && typeof v === 'function') {
      v(node);
    } else if (v === true) {
      node.setAttribute(k, '');
    } else {
      node.setAttribute(k, v);
    }
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null || c === false) return;
    if (typeof c === 'string' || typeof c === 'number') {
      node.appendChild(document.createTextNode(c));
    } else {
      node.appendChild(c);
    }
  });
  return node;
}

/* -------------------------------------------------------------
   SVG icon registry — minimal Lucide-style strokes
   ------------------------------------------------------------- */
const ICONS = {
  arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="m22 2-11 11"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  bookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  bookCheck: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="m9 9.5 2 2 4-4"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  sparkle: '<path d="M9.94 14.06 12 22l2.06-7.94L22 12l-7.94-2.06L12 2l-2.06 7.94L2 12z"/>',
  alertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  feather: '<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  notebook: '<path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M16 2v20"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  x: '<line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.66-6.16L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.66 6.16L3 16"/><path d="M3 21v-5h5"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  fileUp: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m15 15-3-3-3 3"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  // Voice mode icons
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
  micOff: '<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>',
  speaker: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  playSmall: '<polygon points="6 3 20 12 6 21 6 3"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  waveform: '<line x1="3" y1="12" x2="3" y2="12"/><line x1="6" y1="9" x2="6" y2="15"/><line x1="9" y1="6" x2="9" y2="18"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="15" y1="4" x2="15" y2="20"/><line x1="18" y1="8" x2="18" y2="16"/><line x1="21" y1="11" x2="21" y2="13"/>',
};

export function icon(name, sizeEm = 1) {
  const path = ICONS[name];
  if (!path) return el('span');
  const tpl = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  const wrap = el('span', { class: 'icon', style: { fontSize: `${sizeEm}em` } });
  wrap.innerHTML = tpl;
  return wrap;
}

/* -------------------------------------------------------------
   Toast
   ------------------------------------------------------------- */
export function toast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  const cls = { info: '', success: 'lc-toast-success', error: 'lc-toast-error', warning: 'lc-toast-warning' }[type] || '';
  const ic = type === 'success' ? icon('check') : type === 'error' ? icon('x') : type === 'warning' ? icon('alertTriangle') : icon('sparkle');
  const div = el('div', { class: `lc-toast ${cls} fade-in` }, [
    el('span', { class: 'icon', style: { color: type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--warning, #d97706)' : 'var(--accent)' } }, ic.firstChild ? [] : []),
    el('span', {}, message)
  ]);
  // Prepend the icon properly
  div.innerHTML = '';
  const iconWrap = el('span', { class: 'icon', style: { fontSize: '14px', color: type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--warning, #d97706)' : 'var(--accent)' } });
  iconWrap.appendChild(ic);
  div.appendChild(iconWrap);
  div.appendChild(el('span', {}, message));
  root.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateY(-4px)';
    div.style.transition = 'opacity .3s, transform .3s';
    setTimeout(() => div.remove(), 320);
  }, 2800);
}

/* -------------------------------------------------------------
   Modal
   ------------------------------------------------------------- */
export function showModal(content, opts = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const backdrop = el('div', {
    class: 'modal-backdrop fixed inset-0 z-40 flex items-center justify-center p-4',
    onclick: (e) => { if (e.target === backdrop && opts.dismissOnBackdrop !== false) closeModal(); }
  }, content);
  root.appendChild(backdrop);
  // ESC closes
  const handler = (e) => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', handler); }
  };
  document.addEventListener('keydown', handler);
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
}

/* -------------------------------------------------------------
   Time
   ------------------------------------------------------------- */
export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

/* -------------------------------------------------------------
   Progress color class (legacy + new)
   ------------------------------------------------------------- */
export function progressColor(percent) {
  // Legacy callers use this for Tailwind from-/to- classes.
  // New views use progressFillClass for lc-progress-fill variants.
  if (percent >= 80) return 'from-emerald-500 to-emerald-600';
  if (percent >= 40) return 'from-amber-500 to-amber-600';
  return 'from-stone-400 to-stone-500';
}

export function progressFillClass(percent) {
  if (percent >= 80) return 'lc-progress-fill lc-progress-fill-success';
  if (percent >= 40) return 'lc-progress-fill lc-progress-fill-warn';
  if (percent > 0) return 'lc-progress-fill';
  return 'lc-progress-fill lc-progress-fill-mute';
}

/* -------------------------------------------------------------
   Common patterns
   ------------------------------------------------------------- */
export function topbar({ title, eyebrow, back, actions = [] } = {}) {
  return el('div', { class: 'lc-topbar sticky top-0 z-30' }, [
    el('div', { class: 'lc-column-wide px-6 py-4 flex items-center justify-between gap-3' }, [
      el('div', { class: 'flex items-center gap-3 min-w-0 flex-1' }, [
        back ? el('button', {
          class: 'lc-btn lc-btn-text px-2 py-1.5 rounded-md text-sm',
          onclick: back.onClick
        }, [icon('arrowLeft', 1), el('span', {}, back.label || '返回')]) : null,
        el('div', { class: 'min-w-0' }, [
          eyebrow ? el('div', { class: 'lc-eyebrow' }, eyebrow) : null,
          title ? el('div', { class: 'truncate text-base font-medium', style: { fontFamily: 'var(--f-serif-zh)' } }, title) : null
        ])
      ]),
      el('div', { class: 'flex items-center gap-1.5' }, actions)
    ])
  ]);
}

export function sectionHeader({ title, num, action } = {}) {
  return el('div', { class: 'lc-section-h' }, [
    el('div', { class: 'lc-section-title' }, [
      num ? el('span', { class: 'num' }, num) : null,
      el('span', {}, title)
    ]),
    action || null
  ]);
}

export function emptyState({ title = '这里还很安静', desc, action } = {}) {
  return el('div', { class: 'lc-empty fade-in' }, [
    el('div', { class: 'lc-display text-2xl mb-2', style: { color: 'var(--ink-3)' } }, '“'),
    el('div', { class: 'text-base font-medium mb-1', style: { color: 'var(--ink-2)' } }, title),
    desc ? el('div', { class: 'lc-caption' }, desc) : null,
    action ? el('div', { class: 'mt-4' }, action) : null
  ]);
}

/**
 * Book cover element with deterministic spine highlight.
 */
export function bookCover(book, size = 'md') {
  const sizes = {
    sm: { w: 28, h: 40 },
    md: { w: 44, h: 64 },
    lg: { w: 64, h: 92 },
    xl: { w: 96, h: 138 }
  };
  const s = sizes[size] || sizes.md;
  return el('div', {
    class: 'lc-cover shrink-0',
    style: {
      width: s.w + 'px', height: s.h + 'px',
      background: book.cover_color || '#6B6359',
      backgroundImage: `linear-gradient(135deg, ${book.cover_color || '#6B6359'} 0%, ${shade(book.cover_color || '#6B6359', -22)} 100%)`
    }
  });
}

function shade(hex, percent) {
  // Lighten/darken HEX color
  hex = (hex || '#000000').replace('#','');
  if (hex.length === 3) hex = hex.split('').map((c)=>c+c).join('');
  const num = parseInt(hex, 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0xff) + percent;
  let b = (num & 0xff) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/**
 * Author avatar with deterministic gradient based on name.
 */
export function authorAvatar(name, size = 'md') {
  const initial = name?.[0] || '?';
  const cls = size === 'lg' ? 'lc-avatar lc-avatar-lg' : 'lc-avatar';
  // Slight hue rotation by name
  const seed = Array.from(name || '').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = (seed * 13) % 30 - 10; // small drift around sienna
  return el('div', {
    class: cls,
    style: { filter: `hue-rotate(${hue}deg)` }
  }, initial);
}

/* Pad a small number to be readable */
export function pad2(n) {
  return String(n).padStart(2, '0');
}

/* Theme apply */
export function applyTheme(theme) {
  const t = theme || localStorage.getItem('liaoshu_theme') || 'paper';
  if (t === 'paper') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('liaoshu_theme', t);
}

// Initialize on load
applyTheme();

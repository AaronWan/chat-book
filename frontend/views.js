// 视图:书架首页 — magazine-style hero + 状态分组 + Quick Resume
import { api } from './api.js';
import {
  el, toast, showModal, closeModal, formatTime,
  progressFillClass, icon, topbar, sectionHeader,
  emptyState, bookCover, pad2
} from './ui.js';
import { showLoginModal } from './views-auth.js';

export async function renderShelf(container) {
  container.innerHTML = '';
  container.appendChild(skeletonShelf());

  let shelf, books;
  try {
    [shelf, books] = await Promise.all([api.getShelf(), api.listBooks()]);
  } catch (e) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '加载失败', desc: e.message }));
    return;
  }

  const bookMap = new Map(books.map((b) => [b.id, b]));
  const enriched = shelf.map((entry) => ({ ...entry, book: bookMap.get(entry.book_id) }))
                         .filter((e) => e.book);

  const grouped = { '进行中': [], '已聊完': [], '想聊': [], '已暂停': [] };
  enriched.forEach((entry) => {
    if (!grouped[entry.status]) grouped[entry.status] = [];
    grouped[entry.status].push(entry);
  });

  // Find current — most recent in-progress
  const inProgress = grouped['进行中'].slice().sort((a, b) =>
    new Date(b.last_read_at || 0) - new Date(a.last_read_at || 0));
  const currentBook = inProgress[0] || null;

  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  const weekday = ['周日','周一','周二','周三','周四','周五','周六'][today.getDay()];

  container.innerHTML = '';
  container.appendChild(el('div', { class: 'min-h-screen' }, [
    // -------------------- Top bar --------------------
    el('div', { class: 'lc-topbar sticky top-0 z-30' }, [
      el('div', { class: 'lc-column-wide px-6 py-4 flex items-center justify-between' }, [
        el('div', { class: 'flex items-baseline gap-3' }, [
          el('div', { class: 'lc-display text-xl', style: { color: 'var(--accent)' } }, 'Liaoshu'),
          el('div', { class: 'lc-eyebrow hidden sm:block' }, '聊书 · 与作者深读')
        ]),
        el('div', { class: 'flex items-center gap-1.5' }, [
          api.isLoggedIn()
            ? el('div', {
                class: 'lc-eyebrow px-3 py-1',
                style: { color: 'var(--accent)', cursor: 'default' },
                title: '已登录'
              }, api.currentUser.nickname || '用户')
            : el('button', {
                class: 'lc-btn-secondary text-sm px-3 py-1',
                onclick: () => showLoginModal()
              }, '登录'),
          iconButton('search', '搜索对话', () => handleSearch()),
          iconButton('plus', '从书库添加', () => window.liaoshu.goAdd()),
          iconButton('upload', '上传新书', () => window.liaoshu.goUpload()),
          iconButton('settings', '设置', () => window.liaoshu.goSettings()),
        ])
      ])
    ]),
    // -------------------- Anonymous user banner --------------------
    !api.isLoggedIn() ? el('div', {
      class: 'lc-column-wide px-6 py-2 flex items-center justify-between gap-3',
      style: { background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', fontSize: '13px' }
    }, [
      el('span', { style: { color: 'var(--ink-3)' } }, '登录后数据可跨设备同步，清除浏览器也不会丢失'),
      el('button', {
        class: 'lc-link text-sm',
        style: { color: 'var(--accent)', fontSize: '13px' },
        onclick: () => showLoginModal()
      }, '登录 / 注册')
    ]) : null,

    el('div', { class: 'lc-column-wide px-6 py-8 fade-in' }, [
      // -------------------- Hero --------------------
      el('header', { class: 'mb-10' }, [
        el('div', { class: 'flex items-baseline justify-between mb-3' }, [
          el('div', { class: 'lc-eyebrow' }, `${isoDate} · ${weekday} · 今日聊书`),
          el('div', { class: 'lc-caption hidden sm:block' }, `共 ${enriched.length} 本在架`)
        ]),
        el('h1', {
          class: 'mb-3',
          style: { fontFamily: 'var(--f-serif-zh)', fontSize: '40px', fontWeight: '600', lineHeight: '1.15', letterSpacing: '-.005em', color: 'var(--ink-1)' }
        }, currentBook ? [
          el('span', {}, '继续与 '),
          el('span', { class: 'lc-display', style: { color: 'var(--accent)' } }, currentBook.book.author),
          el('span', {}, ' 对话'),
        ] : '挑一位作者,开启今天的对话'),
        el('p', {
          class: 'lc-prose max-w-xl',
          style: { fontSize: '15px', color: 'var(--ink-3)' }
        }, currentBook
          ? `你正在聊《${currentBook.book.title}》。已读 ${currentBook.progress_percent}%。`
          : '聊书不是听讲——是让作者把脑子里的思考过程,与你的思考交叉。')
      ]),

      // -------------------- Quick Resume card --------------------
      currentBook ? quickResumeCard(currentBook) : null,

      // -------------------- Status groups --------------------
      ...renderGroups(grouped),

      // -------------------- Footer CTA --------------------
      enriched.length === 0 ? null : el('div', { class: 'mt-10 pt-8' }, [
        el('div', { class: 'lc-rule lc-rule-soft text-xs mb-6' }, [el('span', {}, '继续探索')]),
        el('div', { class: 'flex flex-wrap gap-3 justify-center' }, [
          el('button', {
            class: 'lc-btn lc-btn-ghost px-4 py-2 rounded-md text-sm',
            onclick: () => window.liaoshu.goAdd()
          }, [icon('plus'), el('span', {}, '从书库添加一本')]),
          el('button', {
            class: 'lc-btn lc-btn-ghost px-4 py-2 rounded-md text-sm',
            onclick: () => window.liaoshu.goUpload()
          }, [icon('upload'), el('span', {}, '上传你想聊的书')]),
        ])
      ])
    ])
  ]));
}

/* ============================================================
   Sub-components
   ============================================================ */

function iconButton(iconName, label, onClick) {
  return el('button', {
    class: 'lc-btn lc-btn-text p-2 rounded-md',
    title: label,
    'aria-label': label,
    onclick: onClick
  }, [icon(iconName, 1.15)]);
}

function quickResumeCard(entry) {
  const b = entry.book;
  const percent = entry.progress_percent || 0;
  return el('article', {
    class: 'lc-card lc-book-card slide-up mb-10 overflow-hidden',
    onclick: () => window.liaoshu.goBook(b.id),
    style: { padding: '0' }
  }, [
    el('div', { class: 'p-6 flex gap-5 items-start' }, [
      bookCover(b, 'lg'),
      el('div', { class: 'flex-1 min-w-0' }, [
        el('div', { class: 'lc-eyebrow mb-1.5', style: { color: 'var(--accent)' } }, '正在进行 · 继续对话'),
        el('h2', {
          class: 'truncate',
          style: { fontFamily: 'var(--f-serif-zh)', fontWeight: '600', fontSize: '22px', color: 'var(--ink-1)', marginBottom: '4px' }
        }, b.title),
        el('div', { class: 'lc-caption mb-3' }, [
          el('span', {}, b.author),
          el('span', { class: 'mx-2', style: { color: 'var(--line-strong)' } }, '·'),
          el('span', {}, b.category),
          entry.last_read_at ? el('span', { class: 'mx-2', style: { color: 'var(--line-strong)' } }, '·') : null,
          entry.last_read_at ? el('span', {}, `${formatTime(entry.last_read_at)} 聊过`) : null
        ]),
        el('div', { class: 'flex items-center gap-3' }, [
          el('div', { class: 'lc-progress-track flex-1' }, [
            el('div', { class: progressFillClass(percent), style: { width: percent + '%' } })
          ]),
          el('span', { class: 'lc-mono tabular-nums text-xs', style: { color: 'var(--ink-3)', minWidth: '36px', textAlign: 'right' } }, percent + '%')
        ])
      ]),
      el('div', { class: 'hidden sm:flex flex-col gap-2 items-end' }, [
        el('button', {
          class: 'lc-btn lc-btn-accent px-4 py-2 rounded-md text-sm',
          onclick: (e) => { e.stopPropagation(); window.liaoshu.goBook(b.id); }
        }, [icon('play'), el('span', {}, '继续')])
      ])
    ])
  ]);
}

function renderGroups(grouped) {
  const meta = {
    '进行中': { icon: 'bookOpen', label: '进行中', num: 'I', desc: '正在与作者对话的书' },
    '已聊完': { icon: 'bookCheck', label: '已聊完', num: 'II', desc: '已经完成的对话与聊书笔记' },
    '想聊': { icon: 'bookmark', label: '想聊的', num: 'III', desc: '加入了书架,等待开始' },
    '已暂停': { icon: 'pause', label: '已暂停', num: 'IV', desc: '暂时搁置的对话' }
  };
  const order = ['进行中', '想聊', '已聊完', '已暂停'];

  return order.map((status) => {
    const entries = grouped[status] || [];
    // Skip empty terminal groups
    if (entries.length === 0 && ['已聊完', '已暂停'].includes(status)) return null;
    const m = meta[status];

    return el('section', { class: 'lc-section fade-in' }, [
      sectionHeader({
        title: m.label,
        num: `${m.num} · ${pad2(entries.length)}`,
        action: el('div', { class: 'lc-caption' }, m.desc)
      }),
      entries.length === 0
        ? emptyState({
            title: status === '进行中' ? '还没开始任何对话' : '这个书架空着',
            desc: status === '进行中' ? '从书库选一本,挑一章开始聊' : '想聊的书会出现在这里',
            action: status === '进行中' ? el('button', {
              class: 'lc-btn lc-btn-ghost px-4 py-2 rounded-md text-sm',
              onclick: () => window.liaoshu.goAdd()
            }, [icon('plus'), el('span', {}, '挑一本书')]) : null
          })
        : el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            entries.map((entry) => renderShelfCard(entry, status))
          )
    ]);
  });
}

function renderShelfCard(entry, status) {
  const book = entry.book;
  const percent = entry.progress_percent || 0;
  const isPaused = status === '已暂停';
  const isDone = status === '已聊完';

  return el('article', {
    class: 'lc-card lc-book-card p-5',
    onclick: () => window.liaoshu.goBook(book.id)
  }, [
    el('div', { class: 'flex gap-4' }, [
      bookCover(book, 'md'),
      el('div', { class: 'flex-1 min-w-0' }, [
        el('div', { class: 'flex items-baseline justify-between gap-3 mb-1' }, [
          el('h3', {
            class: 'truncate',
            style: { fontFamily: 'var(--f-serif-zh)', fontWeight: '600', fontSize: '17px', color: 'var(--ink-1)' }
          }, book.title),
          statusChip(status)
        ]),
        el('div', { class: 'lc-caption mb-3 truncate' }, [
          el('span', {}, book.author),
          el('span', { class: 'mx-1.5', style: { color: 'var(--line-strong)' } }, '·'),
          el('span', {}, `${book.chapter_count} 章`),
          entry.last_read_at ? el('span', { class: 'mx-1.5', style: { color: 'var(--line-strong)' } }, '·') : null,
          entry.last_read_at ? el('span', {}, formatTime(entry.last_read_at)) : null
        ]),
        el('div', { class: 'flex items-center gap-3' }, [
          el('div', { class: 'lc-progress-track flex-1' }, [
            el('div', { class: isDone ? 'lc-progress-fill lc-progress-fill-success' : progressFillClass(percent), style: { width: (isDone ? 100 : percent) + '%' } })
          ]),
          el('span', {
            class: 'lc-mono tabular-nums text-xs',
            style: { color: isDone ? 'var(--success)' : 'var(--ink-3)', minWidth: '36px', textAlign: 'right' }
          }, isDone ? '完' : (percent + '%'))
        ])
      ])
    ])
  ]);
}

function statusChip(status) {
  const map = {
    '进行中': { cls: 'lc-chip lc-chip-accent', label: '进行中' },
    '已聊完': { cls: 'lc-chip lc-chip-success', label: '已聊完' },
    '想聊': { cls: 'lc-chip', label: '想聊' },
    '已暂停': { cls: 'lc-chip', label: '暂停' }
  };
  const m = map[status] || map['想聊'];
  return el('span', { class: m.cls }, m.label);
}

/* ============================================================
   Loading skeleton
   ============================================================ */
function skeletonShelf() {
  return el('div', { class: 'lc-column-wide px-6 py-8 fade-in' }, [
    el('div', { class: 'lc-shimmer mb-4', style: { height: '12px', width: '120px' } }),
    el('div', { class: 'lc-shimmer mb-8', style: { height: '40px', width: '60%' } }),
    el('div', { class: 'lc-shimmer mb-4', style: { height: '120px', width: '100%' } }),
    el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, [
      el('div', { class: 'lc-shimmer', style: { height: '120px' } }),
      el('div', { class: 'lc-shimmer', style: { height: '120px' } })
    ])
  ]);
}

/* ============================================================
   Search modal
   ============================================================ */
function handleSearch() {
  showModal(el('div', { class: 'lc-modal w-full max-w-xl p-6' }, [
    el('div', { class: 'lc-eyebrow mb-1' }, '全局搜索'),
    el('h3', {
      class: 'mb-4',
      style: { fontFamily: 'var(--f-serif-zh)', fontSize: '22px', fontWeight: '600' }
    }, '从历次对话里寻找一句话'),
    el('div', { class: 'relative mb-4' }, [
      el('span', {
        class: 'absolute',
        style: { left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)', fontSize: '16px' }
      }, [icon('search')]),
      el('input', {
        id: 'search-input',
        type: 'text',
        placeholder: '输入关键词,例如「双赢」「焦虑」「心流」...',
        class: 'lc-input',
        style: { paddingLeft: '38px' }
      })
    ]),
    el('div', { id: 'search-results', class: 'max-h-96 overflow-y-auto scrollbar-thin' }, [
      el('div', { class: 'lc-caption text-center py-8' }, '开始输入,从所有书中搜索')
    ]),
    el('div', { class: 'mt-5 flex items-center justify-between' }, [
      el('div', { class: 'lc-caption' }, 'Esc 关闭'),
      el('button', {
        class: 'lc-btn lc-btn-ghost px-4 py-2 rounded-md text-sm',
        onclick: closeModal
      }, '关闭')
    ])
  ]));

  const input = document.getElementById('search-input');
  setTimeout(() => input?.focus(), 50);
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      const resultsEl = document.getElementById('search-results');
      resultsEl.innerHTML = '';
      if (!q) {
        resultsEl.appendChild(el('div', { class: 'lc-caption text-center py-8' }, '开始输入,从所有书中搜索'));
        return;
      }
      resultsEl.appendChild(el('div', { class: 'lc-caption text-center py-4' }, '搜索中...'));
      try {
        const { results } = await api.search(q);
        resultsEl.innerHTML = '';
        if (results.length === 0) {
          resultsEl.appendChild(el('div', { class: 'lc-empty' }, [
            el('div', { style: { color: 'var(--ink-3)' } }, '没有找到相关对话'),
            el('div', { class: 'lc-caption mt-2' }, '换个关键词试试')
          ]));
        } else {
          resultsEl.appendChild(el('div', { class: 'lc-caption mb-3' }, `找到 ${results.length} 条结果`));
          results.forEach((r) => {
            resultsEl.appendChild(el('button', {
              class: 'block w-full text-left p-3 rounded-md lc-hover mb-2 border border-transparent hover:border-[var(--line)]',
              onclick: () => {
                closeModal();
                window.liaoshu.goDialogue(r.book_id, r.chapter_index);
              }
            }, [
              el('div', { class: 'flex items-center gap-2 mb-1' }, [
                el('span', { style: { fontFamily: 'var(--f-serif-zh)', fontSize: '14px', fontWeight: '600' } }, r.book_title),
                el('span', { class: 'lc-chip lc-chip-ghost' }, `第${r.chapter_index}章`),
                el('span', { class: 'lc-chip ' + (r.role === 'user' ? 'lc-chip-ghost' : 'lc-chip-accent') }, r.role === 'user' ? '我' : '作者')
              ]),
              el('div', { class: 'text-sm', style: { color: 'var(--ink-2)', lineHeight: 1.55 } }, r.snippet)
            ]));
          });
        }
      } catch (e) {
        resultsEl.innerHTML = '';
        resultsEl.appendChild(el('div', { class: 'lc-empty', style: { color: 'var(--danger)' } }, `搜索失败: ${e.message}`));
      }
    }, 280);
  });
}

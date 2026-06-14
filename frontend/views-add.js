// 视图:添加新书 — 内置书库带分类筛选 + 搜索
import { api } from './api.js';
import {
  el, toast, icon, emptyState, bookCover, sectionHeader
} from './ui.js';

export async function renderAddBook(container) {
  container.innerHTML = '';
  container.appendChild(el('div', { class: 'lc-column-wide px-6 py-8 fade-in space-y-4' }, [
    el('div', { class: 'lc-shimmer', style: { height: '14px', width: '120px' } }),
    el('div', { class: 'lc-shimmer', style: { height: '40px', width: '50%' } }),
    el('div', { class: 'lc-shimmer mt-4', style: { height: '120px' } })
  ]));

  let books, shelf;
  try {
    [books, shelf] = await Promise.all([api.listBooks(), api.getShelf()]);
  } catch (e) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '加载失败', desc: e.message }));
    return;
  }

  const onShelfIds = new Set(shelf.map((s) => s.book_id));

  // Extract unique categories
  const cats = new Set();
  books.forEach((b) => {
    const main = (b.category || '').split('/')[0].trim();
    if (main) cats.add(main);
  });
  const allCats = ['全部', ...Array.from(cats).sort()];

  let activeCat = '全部';
  let searchQ = '';

  const grid = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' });
  const counter = el('span', { class: 'lc-caption' }, '');

  const renderGrid = () => {
    grid.innerHTML = '';
    const filtered = books.filter((b) => {
      const matchCat = activeCat === '全部' || (b.category || '').includes(activeCat);
      const matchQ = !searchQ || (b.title + b.author + (b.summary || '')).toLowerCase().includes(searchQ.toLowerCase());
      return matchCat && matchQ;
    });
    counter.textContent = `共 ${filtered.length} 本可选`;
    if (filtered.length === 0) {
      grid.appendChild(emptyState({ title: '没有找到符合的书', desc: '试试其他分类或关键词' }));
      return;
    }
    filtered.forEach((book) => {
      const on = onShelfIds.has(book.id);
      grid.appendChild(el('article', {
        class: 'lc-card lc-book-card p-4 flex gap-4 items-start ' + (on ? 'opacity-60' : ''),
        onclick: async () => {
          if (on) { window.liaoshu.goBook(book.id); return; }
          try {
            await api.addToShelf(book.id, '想聊');
            toast(`已加入书架《${book.title}》`, 'success');
            onShelfIds.add(book.id);
            renderGrid();
          } catch (e) { toast('添加失败: ' + e.message, 'error'); }
        }
      }, [
        bookCover(book, 'md'),
        el('div', { class: 'flex-1 min-w-0' }, [
          el('div', { class: 'flex items-baseline justify-between gap-2 mb-1' }, [
            el('h3', {
              class: 'truncate',
              style: { fontFamily: 'var(--f-serif-zh)', fontWeight: '600', fontSize: '16px' }
            }, book.title),
            on ? el('span', { class: 'lc-chip lc-chip-success' }, '已在架') : el('span', { class: 'lc-chip lc-chip-accent' }, '加入')
          ]),
          el('div', { class: 'lc-caption mb-2' }, [
            el('span', {}, book.author),
            el('span', { class: 'mx-1.5', style: { color: 'var(--line-strong)' } }, '·'),
            el('span', {}, `${book.chapter_count} 章`)
          ]),
          el('div', {
            class: 'lc-prose text-sm',
            style: { color: 'var(--ink-3)', fontSize: '13.5px', lineHeight: 1.6,
                     display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }
          }, book.summary || '')
        ])
      ]));
    });
  };

  container.innerHTML = '';
  container.appendChild(el('div', { class: 'min-h-screen' }, [
    // Top bar
    el('div', { class: 'lc-topbar sticky top-0 z-30' }, [
      el('div', { class: 'lc-column-wide px-6 py-4 flex items-center justify-between gap-3' }, [
        el('button', {
          class: 'lc-btn lc-btn-text px-2 py-1.5 rounded-md text-sm',
          onclick: () => window.liaoshu.go('/')
        }, [icon('arrowLeft'), el('span', {}, '书架')]),
        el('div', { class: 'lc-eyebrow' }, '从内置书库添加'),
        el('button', {
          class: 'lc-btn lc-btn-ghost px-3 py-1.5 rounded-md text-sm',
          onclick: () => window.liaoshu.goUpload()
        }, [icon('upload'), el('span', {}, '上传新书')])
      ])
    ]),

    el('div', { class: 'lc-column-wide px-6 py-8 fade-in' }, [
      // Hero
      el('div', { class: 'mb-8' }, [
        el('div', { class: 'lc-eyebrow mb-2' }, 'BUILT-IN LIBRARY'),
        el('h1', {
          style: { fontFamily: 'var(--f-serif-zh)', fontSize: '36px', fontWeight: '600', lineHeight: '1.15', marginBottom: '8px' }
        }, '挑一本书,认识一位作者'),
        el('p', {
          class: 'lc-prose',
          style: { fontSize: '15px', color: 'var(--ink-3)', maxWidth: '40em' }
        }, '每本书都配有专属的作者智能体,带着 ta 的核心信念、表达风格、引导路径,等你来对话。')
      ]),

      // Filters
      el('div', { class: 'mb-6 space-y-4' }, [
        el('div', { class: 'relative' }, [
          el('span', {
            class: 'absolute',
            style: { left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)' }
          }, [icon('search')]),
          el('input', {
            type: 'text',
            placeholder: '搜索书名、作者、内容关键词…',
            class: 'lc-input',
            style: { paddingLeft: '38px' },
            oninput: (e) => { searchQ = e.target.value; renderGrid(); }
          })
        ]),
        el('div', { class: 'flex items-center justify-between flex-wrap gap-3' }, [
          el('div', { class: 'flex flex-wrap gap-1.5' },
            allCats.map((c) => el('button', {
              class: 'lc-btn ' + (activeCat === c ? 'lc-btn-accent' : 'lc-btn-ghost') + ' px-3 py-1 rounded-full text-xs',
              onclick: (e) => {
                activeCat = c;
                renderGrid();
                container.querySelectorAll('[data-catbtn]').forEach((b) => {});
                // re-render filter row
                const allBtns = e.currentTarget.parentElement.querySelectorAll('button');
                allBtns.forEach((b) => {
                  if (b.textContent.trim() === c) { b.className = 'lc-btn lc-btn-accent px-3 py-1 rounded-full text-xs'; }
                  else { b.className = 'lc-btn lc-btn-ghost px-3 py-1 rounded-full text-xs'; }
                });
              }
            }, c))
          ),
          counter
        ])
      ]),

      grid
    ])
  ]));

  renderGrid();
}

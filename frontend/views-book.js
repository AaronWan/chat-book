// 视图:单书空间 + 章节对话 + 章节回顾 + 整书笔记
import { api } from './api.js';
import {
  el, toast, showModal, closeModal, formatTime,
  progressFillClass, icon, sectionHeader, emptyState,
  bookCover, authorAvatar, pad2
} from './ui.js';
import { renderShelf } from './views.js';
import { mountVoiceInput } from './views-voice.js';

/* ============================================================
   Book Space
   ============================================================ */
export async function renderBookSpace(container, book_id) {
  container.innerHTML = '';
  container.appendChild(skeletonBookSpace());

  let overview;
  try {
    overview = await api.getBookOverview(book_id);
  } catch (e) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '加载失败', desc: e.message }));
    return;
  }

  const { book, agent_meta, chapters = [], progress_percent, shelf } = overview;
  const status = shelf?.status || '想聊';
  const completedCount = chapters.filter((c) => c.status === '已聊完').length;
  const inProgressCount = chapters.filter((c) => c.status === '进行中').length;

  container.innerHTML = '';
  container.appendChild(el('div', { class: 'min-h-screen' }, [
    // -------------------- Top bar --------------------
    el('div', { class: 'lc-topbar sticky top-0 z-30' }, [
      el('div', { class: 'lc-column-wide px-6 py-4 flex items-center justify-between gap-3' }, [
        el('button', {
          class: 'lc-btn lc-btn-text px-2 py-1.5 rounded-md text-sm',
          onclick: () => window.liaoshu.go('/')
        }, [icon('arrowLeft'), el('span', {}, '书架')]),
        el('div', { class: 'min-w-0 flex-1 text-center' }, [
          el('div', { class: 'lc-eyebrow' }, '单本书空间'),
          el('div', { class: 'truncate', style: { fontFamily: 'var(--f-serif-zh)', fontSize: '14px', fontWeight: '500' } }, book.title)
        ]),
        el('div', { class: 'flex items-center gap-1' }, [
          shelf ? el('button', {
            class: 'lc-btn lc-btn-text p-2 rounded-md',
            title: '从书架移除',
            onclick: async () => {
              if (!confirm('确认从书架移除?对话与笔记不会被删除。')) return;
              try {
                await api.removeFromShelf(book_id);
                toast('已从书架移除', 'success');
                window.liaoshu.go('/');
              } catch (e) { toast('移除失败: ' + e.message, 'error'); }
            }
          }, [icon('trash')]) : null
        ])
      ])
    ]),

    el('div', { class: 'lc-column-wide px-6 py-8 fade-in' }, [

      // -------------------- Book Hero --------------------
      el('header', { class: 'mb-8' }, [
        el('div', { class: 'lc-eyebrow mb-2', style: { color: 'var(--accent)' } }, book.category),
        el('div', { class: 'flex items-start gap-6' }, [
          el('div', { class: 'flex-1 min-w-0' }, [
            el('h1', {
              style: { fontFamily: 'var(--f-serif-zh)', fontSize: '38px', fontWeight: '600', lineHeight: '1.15', letterSpacing: '-.005em', color: 'var(--ink-1)', marginBottom: '8px' }
            }, book.title),
            el('div', { class: 'mb-5 flex items-center gap-2' }, [
              el('span', { class: 'lc-display text-lg', style: { color: 'var(--accent)' } }, book.author),
              el('span', { class: 'lc-caption' }, '·'),
              el('span', { class: 'lc-caption' }, book.publisher)
            ]),
            el('p', { class: 'lc-prose', style: { fontSize: '15.5px', maxWidth: '52em' } }, book.summary)
          ]),
          el('div', { class: 'hidden md:block' }, [
            bookCover(book, 'xl')
          ])
        ])
      ]),

      // -------------------- Author Card --------------------
      el('section', { class: 'lc-card-warm mb-8 p-5 flex items-start gap-4' }, [
        authorAvatar(agent_meta.name, 'lg'),
        el('div', { class: 'flex-1 min-w-0' }, [
          el('div', { class: 'lc-eyebrow mb-1' }, '作者智能体'),
          el('div', { class: 'flex items-baseline gap-2 mb-2' }, [
            el('span', { style: { fontFamily: 'var(--f-serif-zh)', fontSize: '17px', fontWeight: '600' } }, agent_meta.name),
            agent_meta.born_died ? el('span', { class: 'lc-caption' }, agent_meta.born_died) : null
          ]),
          el('div', { class: 'lc-prose text-sm', style: { color: 'var(--ink-2)' } }, agent_meta.bio || '')
        ])
      ]),

      // -------------------- Progress Row --------------------
      el('section', { class: 'lc-card p-5 mb-8' }, [
        el('div', { class: 'flex items-center justify-between mb-3' }, [
          el('div', { class: 'lc-eyebrow' }, '阅读进度'),
          el('div', { class: 'lc-mono tabular-nums text-sm', style: { color: 'var(--ink-2)' } },
            `${completedCount}/${chapters.length} 章 · ${progress_percent}%`)
        ]),
        el('div', { class: 'lc-progress-track', style: { height: '6px' } }, [
          el('div', { class: progressFillClass(progress_percent), style: { width: progress_percent + '%' } })
        ]),
        el('div', { class: 'mt-3 flex items-center gap-4 lc-caption' }, [
          el('span', {}, `${completedCount} 已聊完`),
          inProgressCount > 0 ? el('span', { style: { color: 'var(--accent)' } }, `${inProgressCount} 进行中`) : null,
          el('span', {}, `${chapters.length - completedCount - inProgressCount} 待聊`)
        ])
      ]),

      // -------------------- Chapter List --------------------
      el('section', { class: 'mb-10' }, [
        sectionHeader({ title: '章节', num: 'Chapters' }),
        el('div', { class: 'lc-card' },
          chapters.map((ch, i) => renderChapterRow(book_id, ch, i === chapters.length - 1, container))
        )
      ]),

      // -------------------- Action Bar --------------------
      el('div', { class: 'lc-actionbar' }, [
        status === '已聊完'
          ? el('button', {
              class: 'lc-btn lc-btn-primary w-full py-3.5 rounded-md text-sm',
              onclick: () => renderBookNoteView(container, book_id)
            }, [icon('notebook'), el('span', {}, '查看整书聊书笔记')])
          : el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3' }, [
              el('button', {
                class: 'lc-btn lc-btn-ghost py-3 rounded-md text-sm',
                onclick: () => showOpeningPicker(container, book_id, chapters)
              }, [icon('bookOpen'), el('span', {}, '挑选章节聊')]),
              el('button', {
                class: 'lc-btn lc-btn-primary py-3 rounded-md text-sm',
                onclick: async () => {
                  const next = chapters.find((c) => c.status !== '已聊完');
                  if (!next) return;
                  if (status === '想聊') {
                    try { await api.startBook(book_id); } catch (_) {}
                  }
                  renderChapterDialogue(container, book_id, next.index);
                }
              }, [
                icon('play'),
                el('span', {}, chapters.some((c) => c.status === '进行中') ? '继续当前章节' : '开始第一章')
              ])
            ])
      ])
    ])
  ]));
}

function renderChapterRow(book_id, ch, isLast, container) {
  const isDone = ch.status === '已聊完';
  const isActive = ch.status === '进行中';
  const stepCls = isDone ? 'lc-step lc-step-done' : isActive ? 'lc-step lc-step-active' : 'lc-step';
  const stepLabel = isDone ? icon('check') : el('span', {}, String(ch.index));

  return el('div', {
    class: 'flex items-start gap-4 p-4 cursor-pointer lc-hover ' + (isLast ? '' : 'border-b'),
    style: { borderColor: 'var(--line-soft)' },
    onclick: () => {
      if (isDone) {
        try { renderChapterReview(container, book_id, ch.index); }
        catch (e) { toast('加载章节复盘失败: ' + e.message, 'error'); }
      } else {
        try { renderChapterDialogue(container, book_id, ch.index); }
        catch (e) { toast('加载章节对话失败: ' + e.message, 'error'); }
      }
    }
  }, [
    el('span', { class: stepCls, style: { marginTop: '2px' } }, [stepLabel]),
    el('div', { class: 'flex-1 min-w-0' }, [
      el('div', { class: 'flex items-baseline gap-2 mb-1' }, [
        el('span', { class: 'lc-display text-sm', style: { color: 'var(--accent)' } }, `Ch. ${ch.index}`),
        el('span', { style: { fontFamily: 'var(--f-serif-zh)', fontSize: '16px', fontWeight: '600', color: 'var(--ink-1)' } }, ch.title)
      ]),
      el('div', { class: 'lc-prose text-sm', style: { color: 'var(--ink-3)', lineHeight: 1.65 } }, ch.proposition || '')
    ]),
    el('div', { class: 'flex items-center gap-2 shrink-0' }, [
      isDone
        ? el('span', { class: 'lc-chip lc-chip-success' }, `${ch.dialogue_turns} 轮`)
        : isActive
          ? el('span', { class: 'lc-chip lc-chip-accent' }, '进行中')
          : el('span', { class: 'lc-chip' }, '待聊'),
      el('span', { class: 'lc-btn lc-btn-text p-1 rounded-md', style: { color: 'var(--ink-4)' } }, [icon('chevronRight')])
    ])
  ]);
}

function showOpeningPicker(container, book_id, chapters) {
  showModal(el('div', { class: 'lc-modal w-full max-w-md p-6' }, [
    el('div', { class: 'lc-eyebrow mb-2' }, '挑一章开始'),
    el('h3', { style: { fontFamily: 'var(--f-serif-zh)', fontSize: '20px', fontWeight: '600', marginBottom: '16px' } }, '今天想从哪里聊起?'),
    el('div', { class: 'max-h-80 overflow-y-auto scrollbar-thin space-y-2' },
      chapters.map((ch) => el('button', {
        class: 'w-full text-left p-3 rounded-md lc-hover border border-transparent hover:border-[var(--line)]',
        onclick: async () => {
          closeModal();
          try { await api.startBook(book_id); } catch (_) {}
          renderChapterDialogue(container, book_id, ch.index);
        }
      }, [
        el('div', { class: 'flex items-baseline gap-2 mb-0.5' }, [
          el('span', { class: 'lc-display text-xs', style: { color: 'var(--accent)' } }, `Ch.${ch.index}`),
          el('span', { style: { fontFamily: 'var(--f-serif-zh)', fontWeight: '600' } }, ch.title)
        ]),
        el('div', { class: 'lc-caption truncate' }, ch.proposition)
      ]))
    ),
    el('div', { class: 'mt-5 text-right' }, [
      el('button', { class: 'lc-btn lc-btn-ghost px-4 py-2 rounded-md text-sm', onclick: closeModal }, '取消')
    ])
  ]));
}

function skeletonBookSpace() {
  return el('div', { class: 'lc-column-wide px-6 py-8 fade-in' }, [
    el('div', { class: 'lc-shimmer mb-3', style: { height: '12px', width: '80px' } }),
    el('div', { class: 'lc-shimmer mb-3', style: { height: '40px', width: '50%' } }),
    el('div', { class: 'lc-shimmer mb-8', style: { height: '20px', width: '70%' } }),
    el('div', { class: 'lc-shimmer mb-6', style: { height: '80px' } }),
    el('div', { class: 'space-y-3' }, Array.from({ length: 4 }, () =>
      el('div', { class: 'lc-shimmer', style: { height: '64px' } })
    ))
  ]);
}

/* ============================================================
   Chapter Dialogue
   ============================================================ */
export async function renderChapterDialogue(container, book_id, chapter_index) {
  container.innerHTML = '';
  container.appendChild(el('div', { class: 'flex items-center justify-center h-screen' }, [
    el('div', { class: 'lc-shimmer', style: { height: '32px', width: '200px' } })
  ]));

  let overview, dialogue, book, agent;
  try {
    [overview, dialogue, book, agent] = await Promise.all([
      api.getBookOverview(book_id),
      api.getDialogue(book_id, chapter_index),
      api.getBook(book_id),
      api.getAgent(book_id)
    ]);
  } catch (e) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '加载对话失败', desc: e.message }));
    return;
  }

  const chapter = overview.chapters.find((c) => c.index === chapter_index);

  if (!chapter) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '章节不存在', desc: '未找到对应章节信息' }));
    return;
  }

  if (!agent?.author?.name) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '作者信息缺失', desc: '无法加载作者信息,请稍后重试' }));
    toast('未加载到作者信息', 'error');
    return;
  }

  if (dialogue.length === 0) {
    // generate opening message
    container.innerHTML = '';
    renderDialogueUI(container, book_id, chapter_index, chapter, book, agent, []);
    showOpeningLoading(agent.author.name);
    try {
      await api.startChapter(book_id, chapter_index);
      const fresh = await api.getDialogue(book_id, chapter_index);
      renderDialogueUI(container, book_id, chapter_index, chapter, book, agent, fresh);
    } catch (e) {
      toast('开场白生成失败: ' + e.message, 'error');
      renderDialogueUI(container, book_id, chapter_index, chapter, book, agent, []);
    }
  } else {
    renderDialogueUI(container, book_id, chapter_index, chapter, book, agent, dialogue);
  }
}

function renderDialogueUI(container, book_id, chapter_index, chapter, book, agent, dialogue) {
  dialogue = dialogue || [];
  if (!agent?.author?.name) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '作者信息缺失', desc: '无法加载作者信息,请稍后重试' }));
    toast('未加载到作者信息', 'error');
    return;
  }
  const authorName = agent.author.name;
  container.innerHTML = '';

  // Determine progress info in chapter
  const totalChapters = book.chapter_count || 1;
  const chPercent = Math.round((chapter_index - (chapter.status === '已聊完' ? 0 : 1)) / totalChapters * 100);

  // 语音模式状态
  const MAX_DIALOGUE_TURNS = 50;
  let voiceMode = false;
  let voiceCtrl = null;
  let currentInputArea = null;
  let countSpan = null;
  let dialogueCount = dialogue.length;
  let isSending = false;

  function bumpDialogueCount() {
    dialogueCount++;
    if (countSpan) {
      if (dialogueCount >= MAX_DIALOGUE_TURNS) {
        countSpan.textContent = `已达上限 ${MAX_DIALOGUE_TURNS} 轮`;
        countSpan.style.color = 'var(--warning, #d97706)';
      } else {
        countSpan.textContent = `${dialogueCount} 轮对话`;
      }
    }
  }

  // 50轮上限弹窗
  function showLimitModal() {
    const desc = el('p', {
      class: 'lc-prose text-center',
      style: { fontSize: '14px', color: 'var(--ink-3)', lineHeight: '1.6' }
    }, '你已经和作者深入探讨了很多问题。建议先保存本章笔记，再继续下一章或开启新章节。');

    const btnSave = el('button', {
      class: 'lc-btn lc-btn-accent px-5 py-3 rounded-md text-sm flex-1',
      onclick: async () => {
        closeModal();
        try {
          await api.closeChapter(book_id, chapter_index);
          toast('笔记已保存', 'success');
          renderBookSpace(container, book_id);
        } catch (e) {
          toast('保存失败: ' + e.message, 'error');
        }
      }
    }, [icon('bookOpen', 0.85), el('span', {}, '保存笔记')]);

    const nextCh = (chapter_index || 0) + 1;
    const hasNext = overview?.chapters?.[nextCh - 1];

    const btnNext = el('button', {
      class: 'lc-btn lc-btn-secondary px-5 py-3 rounded-md text-sm flex-1',
      onclick: () => {
        closeModal();
        window.liaoshu.go(`/book/${book_id}/chapter/${nextCh}`);
      }
    }, hasNext
      ? [icon('arrowRight', 0.85), el('span', {}, '继续下一章')]
      : [icon('bookCheck', 0.85), el('span', {}, '回到书架')]
    );

    const btnKeep = el('button', {
      class: 'lc-btn px-5 py-3 rounded-md text-sm flex-1',
      style: { background: 'var(--surface-2)', color: 'var(--ink-3)' },
      onclick: () => closeModal()
    }, [icon('x', 0.85), el('span', {}, '继续聊这章')]);

    const content = el('div', {
      class: 'lc-card p-8',
      style: { minWidth: '340px', maxWidth: '440px', textAlign: 'center' }
    }, [
      el('div', { class: 'mb-5', style: { fontSize: '40px' } }, '⚡'),
      el('div', {
        class: 'lc-display text-xl mb-2',
        style: { fontFamily: 'var(--f-serif-zh)', color: 'var(--ink-1)' }
      }, `已达${MAX_DIALOGUE_TURNS}轮对话`),
      desc,
      el('div', { class: 'flex gap-3 mt-6' }, [btnSave, btnNext]),
      el('div', { class: 'mt-3' }, [btnKeep])
    ]);

    showModal(content, { dismissOnBackdrop: false });
  }

  const root = el('div', { class: 'h-screen flex flex-col', style: { background: 'var(--bg-paper)' } });

  // ----------- Top bar -----------
  const voiceToggleBtn = el('button', {
    class: 'lc-btn lc-btn-text p-2 rounded-md',
    title: '切换语音模式',
    id: 'voice-toggle-btn',
    onclick: () => toggleVoiceMode()
  }, [icon('micOff')]);

  const header = el('div', { class: 'lc-topbar' }, [
    el('div', { class: 'lc-column px-5 py-3 flex items-center justify-between gap-3' }, [
      el('button', {
        class: 'lc-btn lc-btn-text p-2 rounded-md',
        title: '返回书空间',
        onclick: () => {
          if (voiceCtrl) { voiceCtrl.deactivate(); voiceCtrl = null; }
          renderBookSpace(container, book_id);
        }
      }, [icon('arrowLeft')]),
      el('div', { class: 'flex-1 min-w-0 text-center' }, [
        el('div', { class: 'lc-eyebrow' }, `Ch. ${chapter_index} / ${totalChapters} · 与 ${authorName} 对话`),
        el('div', { class: 'truncate', style: { fontFamily: 'var(--f-serif-zh)', fontSize: '14px', fontWeight: '500' } }, chapter.title)
      ]),
      el('div', { class: 'flex items-center gap-1' }, [
        voiceToggleBtn,
        el('button', {
          class: 'lc-btn lc-btn-text p-2 rounded-md',
          title: '暂停 / 进度',
          onclick: () => showResumeModal(container, book_id, chapter_index, book, agent, chapter)
        }, [icon('pause')]),
        el('button', {
          class: 'lc-btn lc-btn-text p-2 rounded-md',
          title: '结束本章并生成笔记',
          onclick: async () => {
            if (!confirm('确认结束本章对话?将自动生成聊书笔记。')) return;
            if (voiceCtrl) { voiceCtrl.deactivate(); voiceCtrl = null; }
            try {
              await api.closeChapter(book_id, chapter_index);
              toast('聊书笔记已生成', 'success');
              renderChapterReview(container, book_id, chapter_index);
            } catch (e) {
              toast('生成失败: ' + e.message, 'error');
            }
          }
        }, [icon('check')])
      ])
    ]),
    // Tiny chapter proposition strip
    el('div', { class: 'lc-column px-5 pb-3', style: { borderTop: '1px dashed var(--line)' } }, [
      el('div', {
        class: 'lc-quote text-sm pt-2',
        style: { color: 'var(--ink-3)', textAlign: 'center' }
      }, '— ' + (chapter.proposition || '') + ' —')
    ])
  ]);

  // ----------- Messages -----------
  const messagesEl = el('div', { class: 'flex-1 overflow-y-auto scrollbar-thin' });
  const messagesInner = el('div', { class: 'lc-column px-5 py-6 space-y-5' });
  messagesEl.appendChild(messagesInner);

  if (dialogue.length === 0) {
    messagesInner.appendChild(openingPlaceholder(authorName));
  } else {
    dialogue.forEach((m) => messagesInner.appendChild(renderMessage(m, authorName)));
  }

  // ----------- Input area builders -----------
  function buildTextInputArea() {
    let sendBtn;
    const area = el('div', { style: { borderTop: '1px solid var(--line)', background: 'var(--bg-card)' } }, [
      el('div', { class: 'lc-column px-5 py-4' }, [
        el('div', { class: 'flex items-end gap-3' }, [
          el('div', { class: 'flex-1' }, [
            el('textarea', {
              id: 'msg-input',
              rows: '2',
              placeholder: `把你的想法/疑问/经历告诉 ${authorName}…`,
              class: 'lc-textarea',
              style: { lineHeight: 1.65 },
              oninput: autoresize,
              onkeydown: (e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  sendBtn.click();
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendBtn.click();
                }
              }
            })
          ]),
          el('button', {
            id: 'send-btn',
            class: 'lc-btn lc-btn-accent px-5 py-3 rounded-md text-sm shrink-0',
            ref: (n) => { sendBtn = n; },
            onclick: async () => {
              if (isSending) return;
              if (dialogueCount >= MAX_DIALOGUE_TURNS) {
                showLimitModal();
                return;
              }
              isSending = true;
              const input = document.getElementById('msg-input');
              const content = input.value.trim();
              if (!content) { isSending = false; return; }
              input.value = '';
              input.style.height = 'auto';
              input.disabled = true;
              sendBtn.disabled = true;
              sendBtn.classList.add('opacity-70');

              messagesInner.appendChild(renderMessage({ role: 'user', content }, authorName));
              scrollToBottom(messagesEl);

              const loading = renderLoadingMessage(authorName);
              messagesInner.appendChild(loading);
              scrollToBottom(messagesEl);

              try {
                const { author_message } = await api.sendMessage(book_id, chapter_index, content);
                loading.remove();
                messagesInner.appendChild(renderMessage(author_message, authorName));
                scrollToBottom(messagesEl);
                bumpDialogueCount();
              } catch (e) {
                loading.remove();
                const isNet = !navigator.onLine || e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed');
                toast(isNet ? '网络连接失败，请检查网络后重试' : '发送失败: ' + e.message, 'error');
              } finally {
                isSending = false;
                input.disabled = false;
                sendBtn.disabled = false;
                sendBtn.classList.remove('opacity-70');
                input.focus();
              }
            }
          }, [icon('send'), el('span', { class: 'hidden sm:inline' }, '发送')])
        ]),
        el('div', { class: 'mt-2 flex items-center justify-between lc-caption' }, [
          el('span', {}, '⌘/Ctrl + Enter 或 Enter 发送 · Shift + Enter 换行'),
          countSpan = el('span', { class: 'tabular-nums' }, `${dialogueCount} 轮对话`)
        ])
      ])
    ]);
    return area;
  }

  function toggleVoiceMode() {
    voiceMode = !voiceMode;
    // 切回文字模式前清理语音
    if (!voiceMode && voiceCtrl) {
      voiceCtrl.deactivate();
      voiceCtrl = null;
    }
    // 替换 inputArea
    if (voiceMode) {
      const ctrl = mountVoiceInput({
        book_id, chapter_index, authorName,
        messagesInner,
        scrollToBottom: () => scrollToBottom(messagesEl),
        onDialogueUpdate: bumpDialogueCount
      });
      voiceCtrl = ctrl;
      setInputArea(ctrl.element);
    } else {
      setInputArea(buildTextInputArea());
    }
    // 顶栏按钮样式
    voiceToggleBtn.innerHTML = '';
    voiceToggleBtn.appendChild(icon(voiceMode ? 'mic' : 'micOff'));
    if (voiceMode) voiceToggleBtn.classList.add('lc-voice-toggle-on');
    else voiceToggleBtn.classList.remove('lc-voice-toggle-on');
  }

  function setInputArea(newArea) {
    if (currentInputArea && currentInputArea.parentNode === root) {
      root.replaceChild(newArea, currentInputArea);
    } else {
      root.appendChild(newArea);
    }
    currentInputArea = newArea;
  }

  root.appendChild(header);
  root.appendChild(messagesEl);
  root.appendChild(buildTextInputArea());
  currentInputArea = root.lastChild;
  container.appendChild(root);

  setTimeout(() => scrollToBottom(messagesEl, false), 30);
}

function autoresize(e) {
  const t = e.target;
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, 200) + 'px';
}

function scrollToBottom(messagesEl, smooth = true) {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

function renderMessage(m, authorName) {
  if (m.role === 'author') {
    return el('div', { class: 'flex gap-3 fade-in items-start' }, [
      authorAvatar(authorName),
      el('div', { class: 'flex-1 min-w-0' }, [
        el('div', { class: 'lc-caption mb-1' }, authorName),
        el('div', {
          class: 'author-bubble px-4 py-3.5',
          style: { fontFamily: 'var(--f-serif-zh)', fontSize: '15.5px', lineHeight: 1.78, color: 'var(--ink-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
        }, m.content)
      ])
    ]);
  }
  return el('div', { class: 'flex gap-3 fade-in items-start justify-end' }, [
    el('div', { class: 'flex-1 max-w-[82%] flex flex-col items-end min-w-0' }, [
      el('div', { class: 'lc-caption mb-1' }, '我'),
      el('div', {
        class: 'user-bubble px-4 py-3.5',
        style: { fontFamily: 'var(--f-serif-zh)', fontSize: '15.5px', lineHeight: 1.78, color: 'var(--ink-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
      }, m.content)
    ])
  ]);
}

function renderLoadingMessage(authorName) {
  return el('div', { class: 'flex gap-3 fade-in items-start', id: 'loading-msg' }, [
    authorAvatar(authorName),
    el('div', { class: 'flex-1' }, [
      el('div', { class: 'lc-caption mb-1' }, `${authorName} 正在思考…`),
      el('div', { class: 'author-bubble px-4 py-4 inline-flex gap-1.5' }, [
        el('div', { class: 'typing-dot' }),
        el('div', { class: 'typing-dot' }),
        el('div', { class: 'typing-dot' })
      ])
    ])
  ]);
}

function openingPlaceholder(authorName) {
  return el('div', { class: 'text-center py-16 fade-in' }, [
    el('div', { class: 'lc-display text-3xl mb-3', style: { color: 'var(--ink-3)' } }, '“'),
    el('div', { class: 'lc-caption' }, `${authorName} 正在准备开场…`)
  ]);
}

function showOpeningLoading(authorName) {
  // No-op: the empty placeholder + initial UI is enough.
}

async function showResumeModal(container, book_id, chapter_index, book, agent, chapter) {
  if (!agent?.author?.name) {
    toast('未加载到作者信息', 'error');
    return;
  }
  try {
    const {
      recent_dialogue = [],
      pending_questions = [],
      remaining_topics = [],
      dialogue_turns = 0
    } = await api.getResume(book_id, chapter_index);

    showModal(el('div', { class: 'lc-modal w-full max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin' }, [
      el('div', { class: 'p-6' }, [
        el('div', { class: 'lc-eyebrow mb-2' }, '本章进度 · 暂停回顾'),
        el('h3', {
          class: 'mb-1',
          style: { fontFamily: 'var(--f-serif-zh)', fontSize: '22px', fontWeight: '600' }
        }, book.title),
        el('div', { class: 'lc-caption mb-5' }, `第${chapter_index}章 · ${chapter.title} · 已聊 ${dialogue_turns} 轮`),

        recent_dialogue.length > 0 ? el('div', { class: 'mb-5' }, [
          el('div', { class: 'lc-eyebrow mb-2' }, '最近聊到'),
          el('div', { class: 'lc-card-warm p-4 space-y-2' },
            recent_dialogue.slice(-4).map((m) =>
              el('div', { class: 'text-sm' }, [
                el('span', { class: 'lc-caption mr-1.5' }, m.role === 'user' ? '我:' : `${agent.author.name}:`),
                el('span', { style: { fontFamily: 'var(--f-serif-zh)' } }, m.content.slice(0, 90) + (m.content.length > 90 ? '…' : ''))
              ])
            )
          )
        ]) : null,

        remaining_topics.length > 0 ? el('div', { class: 'mb-5' }, [
          el('div', { class: 'lc-eyebrow mb-2' }, '接下来可以聊'),
          el('div', { class: 'space-y-2' },
            remaining_topics.slice(0, 5).map((t) =>
              el('div', { class: 'lc-card p-3 text-sm', style: { fontFamily: 'var(--f-serif-zh)' } }, [
                el('span', { class: 'lc-display mr-2', style: { color: 'var(--accent)' } }, '·'),
                el('span', {}, t)
              ])
            )
          )
        ]) : null,

        el('div', { class: 'flex justify-end gap-2 mt-6' }, [
          el('button', {
            class: 'lc-btn lc-btn-ghost px-4 py-2 rounded-md text-sm',
            onclick: closeModal
          }, '返回对话')
        ])
      ])
    ]));
  } catch (e) {
    toast('加载失败: ' + e.message, 'error');
  }
}

/* ============================================================
   Chapter Review
   ============================================================ */
export async function renderChapterReview(container, book_id, chapter_index) {
  container.innerHTML = '';
  container.appendChild(el('div', { class: 'lc-column px-6 py-12 space-y-4' }, [
    el('div', { class: 'lc-shimmer', style: { height: '14px', width: '140px' } }),
    el('div', { class: 'lc-shimmer', style: { height: '36px', width: '70%' } }),
    el('div', { class: 'lc-shimmer mt-4', style: { height: '140px' } })
  ]));

  let review, note, agent, book;
  try {
    [review, agent, book] = await Promise.all([
      api.getChapterReview(book_id, chapter_index),
      api.getAgent(book_id),
      api.getBook(book_id)
    ]);
    note = review.note;
  } catch (e) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '加载失败', desc: e.message }));
    return;
  }

  const { chapter, dialogue_summary } = review || {};
  if (!agent?.author?.name) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '作者信息缺失', desc: '无法加载作者信息,请稍后重试' }));
    toast('未加载到作者信息', 'error');
    return;
  }
  const authorName = agent.author.name;
  const nc = note?.content || {};

  container.innerHTML = '';
  container.appendChild(el('div', { class: 'min-h-screen' }, [
    // Top bar
    el('div', { class: 'lc-topbar sticky top-0 z-30' }, [
      el('div', { class: 'lc-column-wide px-6 py-4 flex items-center justify-between gap-3' }, [
        el('button', {
          class: 'lc-btn lc-btn-text px-2 py-1.5 rounded-md text-sm',
          onclick: () => renderBookSpace(container, book_id)
        }, [icon('arrowLeft'), el('span', {}, '返回')]),
        el('div', { class: 'lc-eyebrow text-center flex-1' }, '章节复盘'),
        el('div', { class: 'flex items-center gap-1' }, [
          el('button', {
            class: 'lc-btn lc-btn-ghost px-3 py-1.5 rounded-md text-sm',
            onclick: () => renderChapterDialogue(container, book_id, chapter_index)
          }, [icon('message'), el('span', {}, '继续聊')])
        ])
      ])
    ]),

    el('article', { class: 'lc-column px-6 py-10 fade-in' }, [
      el('div', { class: 'lc-eyebrow mb-2' }, `${book.title} · 第 ${chapter_index} 章`),
      el('h1', {
        style: { fontFamily: 'var(--f-serif-zh)', fontSize: '36px', fontWeight: '600', lineHeight: '1.2', marginBottom: '8px' }
      }, chapter.title),
      el('div', { class: 'lc-caption mb-8 flex items-center gap-2' }, [
        el('span', {}, `${authorName} · ${dialogue_summary.total_turns} 轮对话`),
        el('span', {}, '·'),
        el('span', {}, formatTime(note?.updated_at || new Date().toISOString()))
      ]),

      // ----- 核心命题 -----
      el('section', { class: 'lc-section' }, [
        el('div', { class: 'lc-eyebrow mb-2' }, `${authorName} 在这一章带你思考`),
        el('div', { class: 'lc-pull lc-quote' }, [el('div', { style: { fontSize: '17px' } }, chapter.proposition)])
      ]),

      // ----- 碰撞 -----
      nc.collisions?.length > 0 ? el('section', { class: 'lc-section' }, [
        sectionHeader({ title: '我们在这章碰撞了什么', num: 'I' }),
        el('div', { class: 'space-y-3' },
          nc.collisions.map((c) =>
            el('div', { class: 'lc-card p-5' }, [
              el('div', { class: 'mb-3' }, [
                el('div', { class: 'lc-eyebrow mb-1' }, '我'),
                el('div', { class: 'lc-prose text-sm', style: { color: 'var(--ink-2)' } }, c.user)
              ]),
              el('div', {}, [
                el('div', { class: 'lc-eyebrow mb-1', style: { color: 'var(--accent)' } }, authorName),
                el('div', { class: 'lc-prose text-sm' }, c.author)
              ])
            ])
          )
        )
      ]) : null,

      // ----- 核心收获 -----
      nc.core_insights?.length > 0 ? el('section', { class: 'lc-section' }, [
        sectionHeader({ title: '你的独特洞见', num: 'II' }),
        el('ul', { class: 'lc-card p-5 space-y-3' },
          nc.core_insights.map((i) =>
            el('li', { class: 'flex gap-3 lc-prose text-sm', style: { color: 'var(--ink-1)' } }, [
              el('span', { class: 'lc-display shrink-0', style: { color: 'var(--accent)' } }, '◆'),
              el('span', {}, i)
            ])
          )
        )
      ]) : null,

      // ----- 待续 -----
      nc.questions?.length > 0 ? el('section', { class: 'lc-section' }, [
        sectionHeader({ title: '未完成的问题', num: 'III' }),
        el('ul', { class: 'lc-card-warm p-5 space-y-3' },
          nc.questions.map((q) =>
            el('li', { class: 'flex gap-3 lc-prose text-sm' }, [
              el('span', { class: 'lc-display shrink-0', style: { color: 'var(--ink-4)' } }, '?'),
              el('span', {}, q)
            ])
          )
        )
      ]) : null,

      // ----- 延伸思考 -----
      nc.extensions?.length > 0 ? el('section', { class: 'lc-section' }, [
        sectionHeader({ title: '延伸思考', num: 'IV' }),
        el('ul', { class: 'lc-card p-5 space-y-3' },
          nc.extensions.map((e) =>
            el('li', { class: 'flex gap-3 lc-prose text-sm' }, [
              el('span', { class: 'shrink-0', style: { color: 'var(--success)' } }, '→'),
              el('span', {}, e)
            ])
          )
        )
      ]) : null
    ])
  ]));
}

/* ============================================================
   Book Note
   ============================================================ */
export async function renderBookNoteView(container, book_id) {
  container.innerHTML = '';
  container.appendChild(el('div', { class: 'lc-column px-6 py-12 space-y-4' }, [
    el('div', { class: 'lc-shimmer', style: { height: '14px', width: '120px' } }),
    el('div', { class: 'lc-shimmer', style: { height: '46px', width: '60%' } }),
    el('div', { class: 'lc-shimmer mt-4', style: { height: '120px' } })
  ]));

  let book, overview, bookNote;
  try {
    [book, overview, bookNote] = await Promise.all([
      api.getBook(book_id),
      api.getBookOverview(book_id),
      api.getBookNote(book_id)
    ]);
  } catch (e) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '加载失败', desc: e.message }));
    return;
  }

  const completedChapters = overview.chapters.filter((c) => c.status === '已聊完');

  if (!bookNote?.note) {
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'lc-column px-6 py-16 text-center fade-in' }, [
      el('div', { class: 'lc-eyebrow mb-3' }, '整书聊书笔记'),
      el('h1', {
        style: { fontFamily: 'var(--f-serif-zh)', fontSize: '32px', fontWeight: '600' }
      }, book.title),
      el('div', { class: 'lc-caption mb-8' }, `已完成 ${completedChapters.length} / ${overview.chapters.length} 章`),
      completedChapters.length === 0
        ? el('div', { class: 'lc-empty inline-block' }, [
            el('div', { style: { color: 'var(--ink-3)' } }, '请先完成至少一章对话')
          ])
        : el('button', {
            class: 'lc-btn lc-btn-accent px-6 py-3 rounded-md text-sm',
            onclick: async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              btn.innerHTML = '正在生成…';
              try {
                await api.generateBookNote(book_id);
                toast('整书笔记已生成', 'success');
                renderBookNoteView(container, book_id);
              } catch (err) {
                toast('生成失败: ' + err.message, 'error');
                btn.disabled = false;
                btn.innerHTML = '';
                btn.appendChild(icon('feather'));
                btn.appendChild(el('span', {}, '生成整书聊书笔记'));
              }
            }
          }, [icon('feather'), el('span', {}, '生成整书聊书笔记')])
    ]));
    return;
  }

  const bn = bookNote?.note?.content || {};
  const chapters = bn.chapter_notes || [];
  const totalInsights = chapters.reduce((sum, c) => sum + (c.core_insights?.length || 0), 0);

  container.innerHTML = '';
  container.appendChild(el('div', { class: 'min-h-screen' }, [
    el('div', { class: 'lc-topbar sticky top-0 z-30' }, [
      el('div', { class: 'lc-column-wide px-6 py-4 flex items-center justify-between' }, [
        el('button', {
          class: 'lc-btn lc-btn-text px-2 py-1.5 rounded-md text-sm',
          onclick: () => renderBookSpace(container, book_id)
        }, [icon('arrowLeft'), el('span', {}, '返回')]),
        el('div', { class: 'lc-eyebrow' }, '整书聊书笔记'),
        el('button', {
          class: 'lc-btn lc-btn-text text-sm px-3 py-1.5 rounded-md',
          title: '导出 Markdown',
          onclick: async () => {
            try {
              const md = await api.exportBookNote(book_id, 'md');
              const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${book.title}_聊书笔记.md`;
              a.click();
              URL.revokeObjectURL(url);
              toast('已导出 Markdown', 'success');
            } catch (e) {
              toast('导出失败: ' + e.message, 'error');
            }
          }
        }, [icon('download', 0.8), el('span', { class: 'hidden sm:inline' }, 'MD')]),
        el('button', {
          class: 'lc-btn lc-btn-accent text-sm px-3 py-1.5 rounded-md',
          title: '导出 PDF',
          onclick: async () => {
            try {
              const blob = await api.exportBookNote(book_id, 'pdf');
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${book.title}_聊书笔记.pdf`;
              a.click();
              URL.revokeObjectURL(url);
              toast('已导出 PDF', 'success');
            } catch (e) {
              toast('导出失败: ' + e.message, 'error');
            }
          }
        }, [icon('fileUp', 0.8), el('span', { class: 'hidden sm:inline' }, 'PDF')])
      ])
    ]),

    el('article', { class: 'lc-column px-6 py-12 fade-in' }, [
      el('div', { class: 'lc-eyebrow mb-3' }, `${book.author} · ${formatTime(bookNote.note.updated_at)}`),
      el('h1', {
        style: { fontFamily: 'var(--f-serif-zh)', fontSize: '44px', fontWeight: '600', lineHeight: '1.1', letterSpacing: '-.01em', marginBottom: '12px' }
      }, book.title),
      el('div', { class: 'lc-display text-xl mb-10', style: { color: 'var(--ink-3)' } }, '整书聊书笔记'),

      // Stats
      el('section', { class: 'lc-card mb-10' }, [
        el('div', { class: 'grid grid-cols-3 divide-x', style: { borderColor: 'var(--line-soft)' } }, [
          statBlock(bn.reading_info?.turns || 0, '对话轮数'),
          statBlock(totalInsights, '原创洞见'),
          statBlock(chapters.length, '完成章节')
        ])
      ]),

      // Core reflections
      bn.core_reflections?.length > 0 ? el('section', { class: 'lc-section' }, [
        sectionHeader({ title: '整本书读完后我的核心思考', num: 'I' }),
        el('div', { class: 'lc-pull' },
          el('div', { class: 'space-y-2' },
            bn.core_reflections.map((r) =>
              el('div', { class: 'lc-quote', style: { fontSize: '16px' } }, '· ' + r)
            )
          )
        )
      ]) : null,

      // Action changes
      bn.action_changes?.length > 0 ? el('section', { class: 'lc-section' }, [
        sectionHeader({ title: '这本书对我行为的改变', num: 'II' }),
        el('ul', { class: 'lc-card p-5 space-y-3' },
          bn.action_changes.map((a) =>
            el('li', { class: 'flex gap-3 lc-prose' }, [
              el('span', { class: 'shrink-0', style: { color: 'var(--success)' } }, '✓'),
              el('span', {}, a)
            ])
          )
        )
      ]) : null,

      // Per-chapter
      el('section', { class: 'lc-section' }, [
        sectionHeader({ title: '每章核心碰撞', num: 'III' }),
        el('div', { class: 'space-y-4' },
          chapters.map((c) => {
            const ch = overview.chapters.find((x) => x.index === c.chapter_index);
            return el('div', { class: 'lc-card p-5' }, [
              el('div', { class: 'flex items-baseline gap-2 mb-3' }, [
                el('span', { class: 'lc-display text-sm', style: { color: 'var(--accent)' } }, `Ch.${c.chapter_index}`),
                el('span', { style: { fontFamily: 'var(--f-serif-zh)', fontSize: '17px', fontWeight: '600' } }, ch?.title || '')
              ]),
              c.core_insights?.length > 0 ? el('div', {}, [
                el('div', { class: 'lc-eyebrow mb-2' }, '我的核心收获'),
                el('ul', { class: 'space-y-2' },
                  c.core_insights.map((i) => el('li', { class: 'flex gap-2 lc-prose text-sm' }, [
                    el('span', { style: { color: 'var(--accent)' } }, '·'),
                    el('span', {}, i)
                  ]))
                )
              ]) : el('div', { class: 'lc-caption' }, '本章没有原创洞见')
            ]);
          })
        )
      ])
    ])
  ]));
}

function statBlock(n, label) {
  return el('div', { class: 'lc-stat' }, [
    el('div', { class: 'lc-stat-n tabular-nums' }, String(n)),
    el('div', { class: 'lc-stat-l' }, label)
  ]);
}

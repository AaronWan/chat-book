// 视图:上传 + 生成进度 + 草稿编辑
import { api } from './api.js';
import {
  el, toast, showModal, closeModal, icon, sectionHeader, emptyState
} from './ui.js';

/* ============================================================
   Upload
   ============================================================ */
export async function renderUpload(container) {
  container.innerHTML = '';

  let selectedFile = null;

  const dropZone = el('label', {
    id: 'upload-zone',
    for: 'file-input',
    class: 'block border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors',
    style: { borderColor: 'var(--line-strong)', background: 'var(--bg-paper-2)' }
  }, [
    el('div', { class: 'lc-display text-5xl mb-4', style: { color: 'var(--accent-soft)' } }, '“'),
    el('div', {
      style: { fontFamily: 'var(--f-serif-zh)', fontSize: '18px', fontWeight: '600', marginBottom: '6px' }
    }, '把电子书拖到这里,或点击选择'),
    el('div', { class: 'lc-caption' }, '支持 .pdf · .epub · .txt — 单文件最大 50 MB')
  ]);

  const fileInput = el('input', {
    id: 'file-input', type: 'file', accept: '.pdf,.epub,.txt', class: 'hidden'
  });

  const metadataForm = el('div', { id: 'metadata-form', class: 'mt-6 hidden lc-card p-6' }, [
    el('div', { class: 'lc-eyebrow mb-4' }, '元数据 · 帮 AI 更准确地建模'),
    el('div', { class: 'space-y-4' }, [
      field('书名', '如:思考,快与慢', 'book-title', false, '*'),
      field('作者', '如:丹尼尔·卡尼曼(留空,AI 会从文本中识别)', 'book-author'),
      el('div', {}, [
        el('label', { class: 'lc-label' }, '作者补充信息 ', el('span', { class: 'lc-label-hint' }, '可选,优先于 AI 自动识别')),
        el('textarea', {
          id: 'user-notes',
          rows: '3',
          placeholder: '关于这位作者的任何背景、风格、核心观点、写作动机…',
          class: 'lc-textarea',
          style: { lineHeight: 1.6 }
        })
      ]),
      el('div', { id: 'file-info', class: 'lc-caption' }),
      el('button', {
        id: 'submit-upload',
        class: 'lc-btn lc-btn-accent w-full py-3 rounded-md text-sm',
        onclick: () => submitUpload(container)
      }, [icon('sparkle'), el('span', {}, '上传并生成作者智能体')])
    ])
  ]);

  container.appendChild(el('div', { class: 'min-h-screen' }, [
    // Top bar
    el('div', { class: 'lc-topbar sticky top-0 z-30' }, [
      el('div', { class: 'lc-column-wide px-6 py-4 flex items-center justify-between' }, [
        el('button', {
          class: 'lc-btn lc-btn-text px-2 py-1.5 rounded-md text-sm',
          onclick: () => window.liaoshu.go('/')
        }, [icon('arrowLeft'), el('span', {}, '书架')]),
        el('div', { class: 'lc-eyebrow' }, '上传新书 · 自建作者智能体'),
        el('div', {})
      ])
    ]),

    el('div', { class: 'lc-column px-6 py-10 fade-in' }, [
      // Hero
      el('div', { class: 'mb-8' }, [
        el('div', { class: 'lc-eyebrow mb-2', style: { color: 'var(--accent)' } }, 'SELF-BUILT AGENT'),
        el('h1', {
          style: { fontFamily: 'var(--f-serif-zh)', fontSize: '32px', fontWeight: '600', lineHeight: '1.2', marginBottom: '10px' }
        }, '让 AI 通读你的书,生成一个能跟你对话的作者'),
        el('p', { class: 'lc-prose', style: { fontSize: '15px', color: 'var(--ink-3)' } },
          '我们会提取作者的核心信念、表达风格、引导路径,再生成每一章的核心命题与引导问题。你随后可以审阅、编辑,再启用。'),
        el('div', {
          class: 'lc-card-warm p-3 mt-4 lc-caption',
          style: { color: 'var(--warning)', borderLeft: '3px solid var(--warning)' }
        }, '请只上传你拥有版权或合理使用权限的材料。')
      ]),

      // Steps preview
      el('div', { class: 'mb-8 grid grid-cols-4 gap-2' },
        ['上传', '解析', '建模', '草稿'].map((label, i) => el('div', { class: 'text-center' }, [
          el('div', { class: 'lc-step mx-auto mb-1.5' }, String(i + 1)),
          el('div', { class: 'lc-caption' }, label)
        ]))
      ),

      dropZone,
      fileInput,
      metadataForm
    ])
  ]));

  setupUploadHandlers(container, dropZone, fileInput, metadataForm);
}

function field(label, placeholder, id, multiline, required) {
  return el('div', {}, [
    el('label', { class: 'lc-label', for: id }, [label, required ? el('span', { style: { color: 'var(--accent)' } }, ' *') : null]),
    multiline
      ? el('textarea', { id, rows: '3', placeholder, class: 'lc-textarea' })
      : el('input', { id, type: 'text', placeholder, class: 'lc-input' })
  ]);
}

function setupUploadHandlers(container, zone, input, form) {
  let selectedFile = null;

  function handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'epub', 'txt'].includes(ext)) {
      toast(`不支持的格式: .${ext}`, 'error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast('文件太大(>50MB)', 'error');
      return;
    }
    selectedFile = file;
    // populate dataTransfer-like for submit
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    document.getElementById('book-title').value = file.name.replace(/\.[^.]+$/, '');
    zone.classList.add('hidden');
    form.classList.remove('hidden');
    document.getElementById('file-info').textContent = `已选择: ${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.style.borderColor = 'var(--accent)';
    zone.style.background = 'var(--accent-bg)';
  });
  zone.addEventListener('dragleave', () => {
    zone.style.borderColor = 'var(--line-strong)';
    zone.style.background = 'var(--bg-paper-2)';
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.style.borderColor = 'var(--line-strong)';
    zone.style.background = 'var(--bg-paper-2)';
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', (e) => handleFile(e.target.files[0]));
}

async function submitUpload(container) {
  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();
  const notes = document.getElementById('user-notes').value.trim();
  const fileInput = document.getElementById('file-input');
  const file = fileInput.files[0];

  if (!title) { toast('请填写书名', 'error'); return; }
  if (!file) { toast('请选择文件', 'error'); return; }

  const btn = document.getElementById('submit-upload');
  btn.disabled = true;
  btn.innerHTML = '';
  btn.appendChild(el('span', {}, '上传中…'));

  try {
    const data = await api.uploadBook(file, title, author, notes);
    toast('上传成功!开始生成作者智能体…', 'success');
    renderGenerateProgress(container, data.draft_id, data.book_title);
  } catch (e) {
    toast('上传失败: ' + e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '';
    btn.appendChild(icon('sparkle'));
    btn.appendChild(el('span', {}, '上传并生成作者智能体'));
  }
}

/* ============================================================
   Generate Progress
   ============================================================ */
export async function renderGenerateProgress(container, draftId, bookTitle) {
  container.innerHTML = '';
  container.appendChild(el('div', { class: 'min-h-screen' }, [
    el('div', { class: 'lc-topbar sticky top-0 z-30' }, [
      el('div', { class: 'lc-column px-6 py-4 flex items-center justify-between' }, [
        el('div', { class: 'lc-eyebrow' }, '正在生成作者智能体'),
        el('div', {})
      ])
    ]),
    el('div', { class: 'lc-column px-6 py-10 fade-in' }, [
      el('div', { class: 'lc-eyebrow mb-2', style: { color: 'var(--accent)' } }, 'GENERATING'),
      el('h1', {
        style: { fontFamily: 'var(--f-serif-zh)', fontSize: '30px', fontWeight: '600', marginBottom: '6px' }
      }, `正在阅读《${bookTitle}》`),
      el('p', { class: 'lc-prose mb-8', style: { color: 'var(--ink-3)' } }, 'AI 会通读全文,提炼出作者的思想体系、表达风格,再为每一章生成核心命题与引导问题。'),

      // Progress bar
      el('div', { class: 'lc-card p-5 mb-6' }, [
        el('div', { class: 'flex items-center justify-between mb-3' }, [
          el('div', { class: 'lc-eyebrow' }, '总进度'),
          el('div', { class: 'lc-mono tabular-nums text-sm', id: 'progress-text' }, '0%')
        ]),
        el('div', { class: 'lc-progress-track', style: { height: '6px' } }, [
          el('div', { id: 'progress-bar', class: 'lc-progress-fill', style: { width: '0%' } })
        ])
      ]),

      // Stage list
      el('div', { class: 'space-y-3' }, [
        stageItem('uploaded', '文件已上传', '保存到服务器'),
        stageItem('parsed', '文件已解析', '提取纯文本'),
        stageItem('config_generating', '分析作者思想体系', '核心信念 · 关键命题 · 表达风格'),
        stageItem('config_generated', '作者智能体配置完成', '生成思想体系 / 风格 / 引导 / 追问'),
        stageItem('chapters_generating', '分析章节命题', '为每章生成命题与讨论问题'),
        stageItem('awaiting_confirmation', '生成完成', '请进入草稿确认 / 编辑')
      ])
    ])
  ]));

  startSyncGeneration(container, draftId, bookTitle);
}

function stageItem(id, title, desc) {
  return el('div', { id: `stage-${id}`, class: 'lc-card p-4 flex items-start gap-3 opacity-50 transition-opacity' }, [
    el('div', { class: 'lc-step stage-icon shrink-0 mt-0.5' }, '○'),
    el('div', { class: 'flex-1 min-w-0' }, [
      el('div', { style: { fontFamily: 'var(--f-serif-zh)', fontWeight: '600', fontSize: '14px' } }, title),
      el('div', { class: 'lc-caption' }, desc)
    ])
  ]);
}

function markStage(id, status) {
  const stage = document.getElementById(`stage-${id}`);
  if (!stage) return;
  stage.style.opacity = '1';
  const ic = stage.querySelector('.stage-icon');
  if (status === 'done') {
    ic.textContent = '';
    ic.className = 'lc-step lc-step-done shrink-0 mt-0.5 stage-icon';
    ic.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (status === 'active') {
    ic.textContent = '…';
    ic.className = 'lc-step lc-step-active shrink-0 mt-0.5 stage-icon';
  }
}

async function startSyncGeneration(container, draftId, bookTitle) {
  const stages = ['uploaded', 'parsed', 'config_generating', 'config_generated', 'chapters_generating', 'awaiting_confirmation'];
  let currentStage = 0;

  markStage('uploaded', 'done');
  markStage('parsed', 'done');
  currentStage = 2;
  updateProgress(20);

  const interval = setInterval(() => {
    if (currentStage < stages.length) {
      markStage(stages[currentStage], 'active');
      updateProgress(Math.min(20 + currentStage * 15, 90));
      currentStage++;
    }
  }, 8000);

  try {
    const data = await api.generateDraft(draftId);
    clearInterval(interval);
    stages.forEach((s) => markStage(s, 'done'));
    updateProgress(100);
    toast('生成完成', 'success');
    setTimeout(() => renderDraftEdit(container, draftId, bookTitle, data), 700);
  } catch (e) {
    clearInterval(interval);
    toast('生成失败: ' + e.message, 'error');
    container.appendChild(el('div', { class: 'lc-column px-6 mt-6 text-center' }, [
      el('button', {
        class: 'lc-btn lc-btn-ghost px-6 py-2 rounded-md text-sm',
        onclick: () => window.liaoshu.go('/')
      }, '返回书架')
    ]));
  }
}

function updateProgress(percent) {
  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  if (bar) bar.style.width = `${percent}%`;
  if (text) text.textContent = `${percent}%`;
}

/* ============================================================
   Draft Edit
   ============================================================ */
export async function renderDraftEdit(container, draftId, bookTitle, generationResult) {
  container.innerHTML = '';
  container.appendChild(el('div', { class: 'lc-column px-6 py-12 space-y-4 fade-in' }, [
    el('div', { class: 'lc-shimmer', style: { height: '32px', width: '60%' } }),
    el('div', { class: 'lc-shimmer mt-4', style: { height: '160px' } }),
    el('div', { class: 'lc-shimmer mt-3', style: { height: '160px' } })
  ]));

  let draft;
  try {
    const { draft: d } = await api.getDraft(draftId);
    draft = d;
  } catch (e) {
    container.innerHTML = '';
    container.appendChild(emptyState({ title: '加载草稿失败', desc: e.message }));
    return;
  }

  container.innerHTML = '';
  container.appendChild(el('div', { class: 'min-h-screen' }, [
    el('div', { class: 'lc-topbar sticky top-0 z-30' }, [
      el('div', { class: 'lc-column-wide px-6 py-4 flex items-center justify-between gap-3' }, [
        el('button', {
          class: 'lc-btn lc-btn-text px-2 py-1.5 rounded-md text-sm',
          onclick: () => window.liaoshu.go('/')
        }, [icon('arrowLeft'), el('span', {}, '书架')]),
        el('div', { class: 'lc-eyebrow' }, '草稿 · 编辑作者智能体'),
        el('button', {
          class: 'lc-btn lc-btn-danger px-3 py-1.5 rounded-md text-sm',
          onclick: async () => {
            if (!confirm('确认放弃这个草稿?')) return;
            try {
              await api.deleteDraft(draftId);
              toast('草稿已删除', 'success');
              window.liaoshu.go('/');
            } catch (e) { toast('删除失败: ' + e.message, 'error'); }
          }
        }, [icon('trash'), el('span', {}, '放弃')])
      ])
    ]),

    el('div', { class: 'lc-column-wide px-6 py-10 fade-in' }, [
      // Hero
      el('div', { class: 'mb-8' }, [
        el('div', { class: 'lc-eyebrow mb-2', style: { color: 'var(--accent)' } }, 'DRAFT'),
        el('h1', {
          style: { fontFamily: 'var(--f-serif-zh)', fontSize: '32px', fontWeight: '600', marginBottom: '8px' }
        }, bookTitle),
        el('p', { class: 'lc-prose', style: { color: 'var(--ink-3)' } }, 'AI 草稿已生成。审阅并按需调整,启用后就可以加入书架开始对话。')
      ]),

      // Editable sections
      el('div', { class: 'space-y-5' }, [
        // Thought system
        el('section', { class: 'lc-card p-6' }, [
          sectionHeader({ title: '思想体系', num: 'I' }),
          el('div', { class: 'space-y-4' }, [
            el('div', {}, [
              el('label', { class: 'lc-label' }, '核心信念 ', el('span', { class: 'lc-label-hint' }, '每行一条')),
              el('textarea', {
                id: 'core-beliefs',
                rows: '5',
                class: 'lc-textarea'
              }, (draft.agent_config.thought_system.core_beliefs || []).join('\n'))
            ]),
            el('div', {}, [
              el('label', { class: 'lc-label' }, '分析框架'),
              el('input', { id: 'framework', type: 'text', class: 'lc-input', value: draft.agent_config.thought_system.thinking_framework || '' })
            ])
          ])
        ]),

        // Style
        el('section', { class: 'lc-card p-6' }, [
          sectionHeader({ title: '表达风格', num: 'II' }),
          el('div', { class: 'space-y-4' }, [
            el('div', {}, [
              el('label', { class: 'lc-label' }, '语言风格'),
              el('input', { id: 'lang-style', type: 'text', class: 'lc-input', value: draft.agent_config.style.language_style || '' })
            ]),
            el('div', {}, [
              el('label', { class: 'lc-label' }, '常用表达 ', el('span', { class: 'lc-label-hint' }, '每行一条')),
              el('textarea', {
                id: 'fav-expr',
                rows: '4',
                class: 'lc-textarea'
              }, (draft.agent_config.style.favorite_expressions || []).join('\n'))
            ])
          ])
        ]),

        // Chapters
        el('section', { class: 'lc-card p-6' }, [
          sectionHeader({ title: `章节 (${draft.chapters?.length || 0})`, num: 'III' }),
          el('div', { class: 'space-y-3 max-h-96 overflow-y-auto scrollbar-thin pr-2' },
            (draft.chapters || []).map((ch) =>
              el('div', { class: 'lc-card-warm p-4' }, [
                el('div', { class: 'flex items-baseline gap-2 mb-1' }, [
                  el('span', { class: 'lc-display text-sm', style: { color: 'var(--accent)' } }, `Ch.${ch.index}`),
                  el('span', { style: { fontFamily: 'var(--f-serif-zh)', fontSize: '15px', fontWeight: '600' } }, ch.title)
                ]),
                el('div', { class: 'lc-prose text-sm', style: { color: 'var(--ink-2)' } }, ch.proposition)
              ])
            )
          )
        ])
      ]),

      // Bottom action
      el('div', { class: 'mt-10 flex flex-col sm:flex-row gap-3' }, [
        el('button', {
          class: 'flex-1 lc-btn lc-btn-accent py-3 rounded-md text-sm',
          onclick: async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.innerHTML = '';
            btn.appendChild(el('span', {}, '启用中…'));
            const updated = {
              ...draft,
              agent_config: {
                ...draft.agent_config,
                thought_system: {
                  ...draft.agent_config.thought_system,
                  core_beliefs: document.getElementById('core-beliefs').value.split('\n').map(s => s.trim()).filter(Boolean),
                  thinking_framework: document.getElementById('framework').value
                },
                style: {
                  ...draft.agent_config.style,
                  language_style: document.getElementById('lang-style').value,
                  favorite_expressions: document.getElementById('fav-expr').value.split('\n').map(s => s.trim()).filter(Boolean)
                }
              }
            };
            try {
              await api.updateDraftConfig(draftId, { agent_config: updated.agent_config, chapters: updated.chapters });
              const result = await api.confirmDraft(draftId);
              toast('作者智能体已启用,加入书架', 'success');
              setTimeout(() => window.liaoshu.goBook(result.book_id), 700);
            } catch (e) {
              toast('启用失败: ' + e.message, 'error');
              btn.disabled = false;
              btn.innerHTML = '';
              btn.appendChild(icon('check'));
              btn.appendChild(el('span', {}, '启用此作者智能体'));
            }
          }
        }, [icon('check'), el('span', {}, '启用此作者智能体')])
      ])
    ])
  ]));
}

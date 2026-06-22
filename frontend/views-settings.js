// 视图:设置 — 卡片化分区 + 主题可视化切换
import { api } from './api.js';
import {
  el, toast, icon, topbar, sectionHeader, applyTheme
} from './ui.js';
import { renderAccountSection } from './views-auth.js';

export async function renderSettings(container) {
  container.innerHTML = '';
  container.appendChild(el('div', { class: 'lc-column px-6 py-8 fade-in' }, [
    el('div', { class: 'lc-shimmer', style: { height: '40px', width: '50%' } }),
    el('div', { class: 'lc-shimmer mt-4', style: { height: '180px' } })
  ]));

  let settings;
  try {
    const { settings: s } = await api.getSettings();
    settings = s;
  } catch (e) {
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'lc-column px-6 py-20 fade-in' }, [
      el('div', { class: 'text-center', style: { color: 'var(--danger)' } }, `加载失败: ${e.message}`)
    ]));
    return;
  }

  const currentTheme = settings.theme || localStorage.getItem('liaoshu_theme') || 'paper';
  const currentLang = settings.language || 'zh';

  const LANGUAGES = [
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'zh-Hant', label: '繁體', flag: '🇭🇰' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' }
  ];

  const goalInput = el('input', {
    id: 'goal-minutes',
    type: 'number',
    min: '5',
    max: '240',
    class: 'lc-input',
    value: settings.reading_goal_minutes_per_day || 30
  });
  const weeklyInput = el('input', {
    id: 'weekly-target',
    type: 'number',
    min: '0',
    max: '10',
    class: 'lc-input',
    value: settings.weekly_target_books || 1
  });
  const notifCheckbox = el('input', {
    id: 'notifications',
    type: 'checkbox',
    class: 'lc-switch-input',
    checked: settings.notifications_enabled !== false
  });
  const reminderInput = el('input', {
    id: 'reminder-time',
    type: 'time',
    class: 'lc-input',
    value: settings.reminder_time || '20:00'
  });

  // Theme selector — visual cards
  const themes = [
    { key: 'paper', label: '纸感', desc: '默认米色纸面,长读舒适', icon: 'feather', preview: '#F4ECDC' },
    { key: 'dark', label: '暗色', desc: '深夜低对比,适合睡前翻阅', icon: 'sparkle', preview: '#1A1814' },
    { key: 'eye-care', label: '护眼', desc: '暖黄底,减少蓝光刺激', icon: 'bookOpen', preview: '#E8DCC4' }
  ];
  const themeCardsWrap = el('div', { class: 'grid grid-cols-1 sm:grid-cols-3 gap-3' });
  let selectedTheme = currentTheme;
  let selectedLang = currentLang;
  const renderThemeCards = () => {
    themeCardsWrap.innerHTML = '';
    themes.forEach((t) => {
      const active = selectedTheme === t.key;
      themeCardsWrap.appendChild(el('button', {
        class: 'lc-card p-4 text-left lc-hover ' + (active ? 'lc-card-warm' : ''),
        style: active ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent)' } : {},
        onclick: () => {
          selectedTheme = t.key;
          applyTheme(t.key); // instant preview
          renderThemeCards();
        }
      }, [
        el('div', { class: 'flex items-center justify-between mb-2' }, [
          el('div', {
            style: {
              width: '36px', height: '36px', borderRadius: '8px',
              background: t.preview,
              border: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }
          }, [icon(t.icon, 0.9)]),
          active ? el('span', { class: 'lc-chip lc-chip-accent' }, '当前') : null
        ]),
        el('div', { class: 'text-sm font-medium mb-0.5', style: { fontFamily: 'var(--f-serif-zh)' } }, t.label),
        el('div', { class: 'lc-caption' }, t.desc)
      ]));
    });
  };

  container.innerHTML = '';
  container.appendChild(el('div', { class: 'min-h-screen' }, [
    topbar({
      back: { label: '书架', onClick: () => window.liaoshu.go('/') }
    }),

    el('div', { class: 'lc-column px-6 py-8 fade-in' }, [
      // Account section
      el('div', { class: 'mb-6' }, (() => {
        const wrap = el('div', {});
        renderAccountSection(wrap);
        return [wrap];
      })()),

      // Hero
      el('header', { class: 'mb-8' }, [
        el('div', { class: 'lc-eyebrow mb-2' }, 'PREFERENCES'),
        el('h1', {
          style: { fontFamily: 'var(--f-serif-zh)', fontSize: '32px', fontWeight: '600', lineHeight: '1.2', marginBottom: '8px' }
        }, '调一调聊书的感觉'),
        el('p', {
          class: 'lc-prose',
          style: { fontSize: '14.5px', color: 'var(--ink-3)' }
        }, '阅读节奏、提醒方式、外观主题——选最顺手的就好。')
      ]),

      // Section I — 阅读目标
      el('section', { class: 'mb-6' }, [
        sectionHeader({ title: '阅读目标', num: 'I · 01' }),
        el('div', { class: 'lc-card p-6 space-y-5' }, [
          el('div', {}, [
            el('div', { class: 'flex items-baseline justify-between mb-2' }, [
              el('label', { class: 'lc-label', for: 'goal-minutes' }, '每日阅读目标'),
              el('span', { class: 'lc-caption' }, '单位:分钟')
            ]),
            goalInput,
            el('div', { class: 'lc-caption mt-1.5' }, '建议 15 – 45 分钟;过短难沉浸,过长易疲劳。')
          ]),
          el('div', {}, [
            el('div', { class: 'flex items-baseline justify-between mb-2' }, [
              el('label', { class: 'lc-label', for: 'weekly-target' }, '每周完成目标'),
              el('span', { class: 'lc-caption' }, '单位:本')
            ]),
            weeklyInput,
            el('div', { class: 'lc-caption mt-1.5' }, '把一本书聊完算作完成;不必严苛,达成 70% 也很好。')
          ])
        ])
      ]),

      // Section II — 通知
      el('section', { class: 'mb-6' }, [
        sectionHeader({ title: '通知与提醒', num: 'II · 02' }),
        el('div', { class: 'lc-card p-6 space-y-5' }, [
          el('div', { class: 'flex items-center justify-between gap-4' }, [
            el('div', { class: 'flex-1' }, [
              el('div', { class: 'text-sm font-medium', style: { fontFamily: 'var(--f-serif-zh)' } }, '启用通知'),
              el('div', { class: 'lc-caption mt-0.5' }, '每日提醒、自建智能体生成完成时会通知你')
            ]),
            el('label', { class: 'lc-switch' }, [
              notifCheckbox,
              el('span', { class: 'lc-switch-slider' })
            ])
          ]),
          el('div', {}, [
            el('label', { class: 'lc-label mb-2', for: 'reminder-time' }, '每日提醒时间'),
            reminderInput,
            el('div', { class: 'lc-caption mt-1.5' }, '找一个你通常会翻开书的时段。')
          ])
        ])
      ]),

      // Section III — 语言
      el('section', { class: 'mb-6' }, [
        sectionHeader({ title: '对话语言', num: 'III · 03' }),
        el('div', { class: 'lc-card p-6' }, [
          el('div', { class: 'lc-caption mb-4' }, '选择作者智能体与你对话使用的语言。'),
          el('div', { class: 'grid grid-cols-1 sm:grid-cols-5 gap-3' }, (() => {
            const wrap = el('div', {});
            const renderLangCards = () => {
              wrap.innerHTML = '';
              LANGUAGES.forEach((lang) => {
                const active = selectedLang === lang.code;
                wrap.appendChild(el('button', {
                  class: 'lc-card p-4 text-center lc-hover ' + (active ? 'lc-card-warm' : ''),
                  style: active ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent)' } : {},
                  onclick: () => {
                    selectedLang = lang.code;
                    renderLangCards();
                  }
                }, [
                  el('div', { style: { fontSize: '24px', marginBottom: '4px' } }, lang.flag),
                  el('div', { class: 'text-sm font-medium' }, lang.label),
                  active ? el('div', { class: 'lc-chip lc-chip-accent mt-1', style: { fontSize: '10px', padding: '1px 6px' } }, '✓') : null
                ]));
              });
            };
            renderLangCards();
            return [wrap];
          })())
        ])
      ]),

      // Section IV — 外观
      el('section', { class: 'mb-6' }, [
        sectionHeader({ title: '外观主题', num: 'IV · 04' }),
        el('div', { class: 'lc-card p-6' }, [
          el('div', { class: 'lc-caption mb-4' }, '点击预览,保存后即生效。'),
          themeCardsWrap
        ])
      ]),

      // Section V — 数据
      el('section', { class: 'mb-6' }, [
        sectionHeader({ title: '数据', num: 'V · 05' }),
        el('div', { class: 'lc-card p-6 space-y-2' }, [
          el('button', {
            class: 'lc-row-btn w-full',
            onclick: async () => {
              try {
                const shelf = await api.getShelf();
                const inProgress = shelf.find(e => e.status === '进行中');
                if (!inProgress) {
                  toast('请先开始聊一本书', 'info');
                  return;
                }
                const md = await api.exportBookNote(inProgress.book_id);
                const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${inProgress.book_id}_聊书笔记.md`;
                a.click();
                URL.revokeObjectURL(url);
                toast('已导出 Markdown', 'success');
              } catch (e) {
                toast('导出失败: ' + e.message, 'error');
              }
            }
          }, [
            icon('download'),
            el('div', { class: 'flex-1 text-left' }, [
              el('div', { class: 'text-sm font-medium' }, '导出所有聊书笔记'),
              el('div', { class: 'lc-caption' }, '生成一份 Markdown 文件，带走你所有的对话')
            ])
          ]),
          el('button', {
            class: 'lc-row-btn w-full lc-row-btn-danger',
            onclick: () => toast('清除功能尚未实现', 'info')
          }, [
            icon('trash'),
            el('div', { class: 'flex-1 text-left' }, [
              el('div', { class: 'text-sm font-medium' }, '清除所有对话历史'),
              el('div', { class: 'lc-caption' }, '谨慎操作——此动作不可恢复')
            ])
          ])
        ])
      ]),

      // Save action
      el('div', { class: 'mt-10 flex items-center justify-between gap-3' }, [
        el('div', { class: 'lc-caption' }, '修改仅在你保存后写入本地设置文件。'),
        el('button', {
          class: 'lc-btn lc-btn-accent px-6 py-2.5 rounded-md text-sm',
          onclick: async () => {
            const newSettings = {
              reading_goal_minutes_per_day: parseInt(document.getElementById('goal-minutes').value, 10),
              weekly_target_books: parseInt(document.getElementById('weekly-target').value, 10),
              notifications_enabled: document.getElementById('notifications').checked,
              reminder_time: document.getElementById('reminder-time').value,
              theme: selectedTheme,
              language: selectedLang
            };
            try {
              await api.updateSettings(newSettings);
              applyTheme(selectedTheme);
              toast('设置已保存', 'success');
            } catch (e) {
              toast('保存失败: ' + e.message, 'error');
            }
          }
        }, [icon('check'), el('span', {}, '保存设置')])
      ])
    ])
  ]));

  renderThemeCards();
}

// 视图:登录/注册弹窗
import { api } from './api.js';
import { el, toast, showModal, closeModal, icon } from './ui.js';

// 显示登录弹窗
export function showLoginModal(onSuccess) {
  let mode = 'login'; // 'login' | 'register'

  const titleEl = el('div', { class: 'lc-display text-lg' }, '登录聊书');
  const usernameInput = el('input', {
    type: 'text',
    class: 'lc-input',
    placeholder: '用户名',
    autocomplete: 'username'
  });
  const passwordInput = el('input', {
    type: 'password',
    class: 'lc-input',
    placeholder: '密码',
    autocomplete: 'current-password'
  });
  const errorEl = el('div', { class: 'text-sm', style: { color: 'var(--danger)', minHeight: '20px' } }, '');
  // 记录登录前的匿名ID，用于成功后提示
  const prevAnonUid = localStorage.getItem('liaoshu_anon_uid');
  const submitBtn = el('button', {
    class: 'lc-btn-primary w-full py-3',
    onclick: async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        errorEl.textContent = '请输入用户名和密码';
        return;
      }
      submitBtn.textContent = '登录中...';
      submitBtn.disabled = true;
      try {
        const user = mode === 'login'
          ? await api.login(username, password)
          : await api.register(username, password);
        closeModal();
        if (onSuccess) onSuccess(user);
        else {
          toast({ type: 'success', text: `欢迎回来, ${user.nickname}！` });
          // 匿名用户首次登录，提示数据仅本地
          if (prevAnonUid && !localStorage.getItem('liaoshu_anon_uid_migrated')) {
            localStorage.setItem('liaoshu_anon_uid_migrated', '1');
            setTimeout(() => {
              // 临时提示元素，6秒后自动消失
              const root = document.getElementById('toast-root');
              const div = document.createElement('div');
              div.className = 'lc-toast fade-in';
              div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:8px;background:var(--surface-warm);border:1px solid var(--line);font-size:13px;color:var(--ink-2);max-width:340px';
              div.innerHTML = '<span style="font-size:13px">ℹ️</span><span>提示：历史对话保存在本地设备，换设备需注册账号同步</span>';
              root.appendChild(div);
              setTimeout(() => {
                div.style.opacity = '0';
                div.style.transition = 'opacity .3s';
                setTimeout(() => div.remove(), 320);
              }, 6000);
            }, 800);
          }
        }
      } catch (e) {
        errorEl.textContent = e.message;
        submitBtn.textContent = mode === 'login' ? '登录' : '注册';
        submitBtn.disabled = false;
      }
    }
  }, mode === 'login' ? '登录' : '注册');

  const switchLink = el('a', {
    href: '#',
    class: 'lc-link text-sm',
    onclick: (e) => {
      e.preventDefault();
      mode = mode === 'login' ? 'register' : 'login';
      titleEl.textContent = mode === 'login' ? '登录聊书' : '注册聊书';
      submitBtn.textContent = mode === 'login' ? '登录' : '注册';
      switchLink.textContent = mode === 'login' ? '没有账号？注册' : '已有账号？登录';
    }
  }, '没有账号？注册');

  const content = el('div', { class: 'lc-column px-8 py-8', style: { minWidth: '320px', maxWidth: '400px' } }, [
    el('div', { class: 'text-center mb-6' }, [
      el('div', { class: 'lc-display text-2xl mb-1', style: { color: 'var(--accent)' } }, '📖 聊书'),
      el('div', { class: 'lc-eyebrow mt-1' }, '与作者深读'),
      titleEl
    ]),
    el('div', { class: 'space-y-4' }, [
      usernameInput,
      passwordInput,
      errorEl,
      submitBtn,
      el('div', { class: 'text-center mt-3' }, [switchLink])
    ])
  ]);

  showModal(content, { dismissOnBackdrop: false });
}

// 显示设置页面中的账号区块
export function renderAccountSection(container) {
  const user = api.currentUser;

  const statusEl = el('div', {});
  if (user.anonymous) {
    statusEl.appendChild(el('div', { class: 'text-sm', style: { color: 'var(--ink-3)' } }, [
      el('span', {}, '未登录'),
      el('span', { class: 'lc-caption block mt-0.5' }, '游客模式数据仅保存在本设备，换设备清空')
    ]));
  } else {
    statusEl.appendChild(el('div', { class: 'flex items-center gap-2' }, [
      el('span', { style: { color: 'var(--success)', fontSize: '14px' } }, '✓'),
      el('div', { class: 'lc-prose' }, `用户名: ${user.username || user.nickname}`)
    ]));
  }

  const btn = user.anonymous
    ? el('button', {
        class: 'lc-btn lc-btn-primary w-full py-3',
        onclick: () => showLoginModal()
      }, '创建账号，永久保存数据')
    : el('button', {
        class: 'lc-btn-secondary w-full py-2.5',
        onclick: () => {
          api.logout();
          toast({ type: 'success', text: '已退出登录' });
          window.location.reload();
        }
      }, '退出登录');

  container.appendChild(el('div', { class: 'lc-card p-5' }, [
    el('div', { class: 'lc-label mb-3' }, '账号'),
    statusEl,
    el('div', { class: 'mt-4' }, [btn])
  ]));
}
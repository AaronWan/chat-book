// API 客户端
// 认证：优先使用 localStorage 中的 session token，回退到匿名 userId
const TOKEN_KEY = 'liaoshu_token';
const USER_KEY = 'liaoshu_user';
const ANON_KEY = 'liaoshu_anon_uid';

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}

function getAnonUserId() {
  let uid = localStorage.getItem(ANON_KEY);
  if (!uid) {
    // 优先使用 URL ?user_id= 参数（用于 QA 截图/测试）
    const urlParam = new URLSearchParams(location.search).get('user_id');
    uid = urlParam || 'demo'; // 默认为 'demo' 以便 headless 截图测试
    localStorage.setItem(ANON_KEY, uid);
  }
  return uid;
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// 当前用户（从存储或匿名）
function getCurrentUser() {
  const user = getStoredUser();
  if (user) return user;
  return { id: getAnonUserId(), nickname: '游客', anonymous: true };
}

// 是否已登录
export function isLoggedIn() {
  return !!getStoredToken();
}

async function request(url, options = {}) {
  const token = getStoredToken();
  const user = getCurrentUser();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // 优先用 token，匿名用户用 X-User-Id
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  } else {
    headers['X-User-Id'] = user.id;
  }

  const resp = await fetch(url, {
    ...options,
    headers
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    // 401 且有 token → token 失效，清除 session
    if (resp.status === 401 && token) {
      clearSession();
    }
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

export const api = {
  // 认证
  get currentUser() { return getCurrentUser(); },
  isLoggedIn,

  login: async (username, password) => {
    const r = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setSession(r.token, r.user);
    return r.user;
  },

  register: async (username, password) => {
    const r = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setSession(r.token, r.user);
    return r.user;
  },

  logout: () => {
    clearSession();
  },

  // 书库
  listBooks: () => request('/api/books').then(r => r?.books || []),
  getBook: (id) => request(`/api/books/${id}`),
  getAgent: (id) => request(`/api/books/${id}/agent`).then(r => r.agent),

  // 书架
  getShelf: () => request('/api/user/shelf').then(r => r.shelf || []),
  addToShelf: (book_id, status = '想聊') =>
    request('/api/user/shelf/add', { method: 'POST', body: JSON.stringify({ book_id, status }) })
      .then(r => r.entry),
  startBook: (book_id) =>
    request('/api/user/shelf/start', { method: 'POST', body: JSON.stringify({ book_id }) }),
  finishBook: (book_id) =>
    request('/api/user/shelf/finish', { method: 'POST', body: JSON.stringify({ book_id }) }),
  removeFromShelf: (book_id) =>
    request(`/api/user/shelf/${book_id}`, { method: 'DELETE' }),

  // 单书空间
  getBookOverview: (book_id) => request(`/api/user/book/${book_id}/overview`),

  // 章节对话
  startChapter: (book_id, chapter_index) =>
    request('/api/user/chapter/start', { method: 'POST', body: JSON.stringify({ book_id, chapter_index }) }),
  sendMessage: (book_id, chapter_index, content) =>
    request('/api/user/chapter/message', { method: 'POST', body: JSON.stringify({ book_id, chapter_index, content }) }),
  getDialogue: (book_id, chapter_index) =>
    request(`/api/user/chapter/${book_id}/${chapter_index}/dialogue`).then(r => Array.isArray(r) ? r : (r?.messages || r?.dialogue || [])),
  getResume: (book_id, chapter_index) =>
    request(`/api/user/chapter/${book_id}/${chapter_index}/resume`),
  closeChapter: (book_id, chapter_index) =>
    request('/api/user/chapter/close', { method: 'POST', body: JSON.stringify({ book_id, chapter_index }) }),
  getChapterReview: (book_id, chapter_index) =>
    request(`/api/user/chapter/${book_id}/${chapter_index}/review`),
  getChapterNote: (book_id, chapter_index) =>
    request(`/api/user/chapter/${book_id}/${chapter_index}/note`),

  // 整书笔记
  getBookNote: (book_id) => request(`/api/user/book/${book_id}/note`),
  generateBookNote: (book_id) =>
    request(`/api/user/book/${book_id}/note/close`, { method: 'POST' }),
  exportBookNote: (book_id, format = 'md') =>
    fetch(`/api/user/book/${book_id}/export?format=${format}`, {
      headers: (() => {
        const token = localStorage.getItem('liaoshu_token');
        return token ? { 'Authorization': 'Bearer ' + token } : {};
      })()
    }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.error); });
      return format === 'pdf' ? r.blob() : r.text();
    }),

  // 搜索
  search: (q, options = {}) => {
    const params = new URLSearchParams({ q });
    if (options.book_id) params.set('book_id', options.book_id);
    if (options.role) params.set('role', options.role);
    if (options.chapter_index) params.set('chapter_index', options.chapter_index);
    return request(`/api/user/search?${params}`);
  },

  // V1.0: 文件上传 + 自建作者智能体
  uploadBook: (file, book_title, book_author, user_notes = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('book_title', book_title);
    form.append('book_author', book_author);
    form.append('user_notes', user_notes);
    const token = getStoredToken();
    return fetch('/api/books/upload', {
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      body: form
    }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.error); });
      return r.json();
    });
  },
  generateDraft: (draftId) => request(`/api/books/draft/${draftId}/generate-sync`, { method: 'POST' }),
  getDraft: (draftId) => request(`/api/books/draft/${draftId}`),
  listDrafts: () => request('/api/books/drafts'),
  updateDraftConfig: (draftId, body) => request(`/api/books/draft/${draftId}/config`, { method: 'PUT', body: JSON.stringify(body) }),
  confirmDraft: (draftId) => request(`/api/books/draft/${draftId}/confirm`, { method: 'POST' }),
  deleteDraft: (draftId) => request(`/api/books/draft/${draftId}`, { method: 'DELETE' }),
  listUploadedBooks: () => request('/api/user/uploaded-books'),

  // V1.0: 设置
  getSettings: () => request('/api/user/settings'),
  updateSettings: (settings) => request('/api/user/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // 语音 (STT + TTS)
  // STT: 发送音频 blob，返回文字
  // 用 JSON+base64 发送,避免后端需要 multer/raw body parser
  stt: async (audioBlob) => {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result;
        const idx = typeof r === 'string' ? r.indexOf(',') : -1;
        resolve(idx >= 0 ? r.slice(idx + 1) : r);
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(audioBlob);
    });
    return request('/api/voice/stt', {
      method: 'POST',
      body: JSON.stringify({ audio: base64 })
    }).then(r => r.text);
  },

  // TTS: 发送文字，返回音频 blob
  tts: async (text, author_name = '') => {
    const r = await request('/api/voice/tts', {
      method: 'POST',
      body: JSON.stringify({ text, author_name })
    });
    // r.audio_url = "/api/voice/audio/tts_xxx.m4a"
    const audioResp = await fetch(r.audio_url);
    if (!audioResp.ok) throw new Error('TTS audio fetch failed');
    return audioResp.blob();
  }
};
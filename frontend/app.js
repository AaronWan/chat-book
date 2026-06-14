// App 入口 + 简易路由
import { renderShelf } from './views.js';
import { renderBookSpace, renderChapterDialogue, renderChapterReview, renderBookNoteView } from './views-book.js';
import { renderAddBook } from './views-add.js';
import { renderUpload, renderGenerateProgress, renderDraftEdit } from './views-upload.js';
import { renderSettings } from './views-settings.js';

const app = document.getElementById('app');

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  return { parts };
}

function route() {
  const { parts } = parseHash();
  app.innerHTML = '';

  if (parts.length === 0) {
    return renderShelf(app);
  }

  const [view, ...args] = parts;

  if (view === 'book' && args[0]) {
    if (args[1] === 'dialogue' && args[2]) {
      return renderChapterDialogue(app, args[0], parseInt(args[2], 10));
    }
    if (args[1] === 'review' && args[2]) {
      return renderChapterReview(app, args[0], parseInt(args[2], 10));
    }
    if (args[1] === 'note') {
      return renderBookNoteView(app, args[0]);
    }
    return renderBookSpace(app, args[0]);
  }

  if (view === 'add') {
    return renderAddBook(app);
  }

  if (view === 'upload') {
    return renderUpload(app);
  }

  if (view === 'generate' && args[0]) {
    return renderGenerateProgress(app, args[0], '生成中...');
  }

  if (view === 'draft' && args[0]) {
    return renderDraftEdit(app, args[0], '草稿编辑');
  }

  if (view === 'settings') {
    return renderSettings(app);
  }

  renderShelf(app);
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);

window.liaoshu = {
  go: (path) => { location.hash = path; },
  goBook: (book_id) => { location.hash = `/book/${book_id}`; },
  goDialogue: (book_id, chapter_index) => { location.hash = `/book/${book_id}/dialogue/${chapter_index}`; },
  goReview: (book_id, chapter_index) => { location.hash = `/book/${book_id}/review/${chapter_index}`; },
  goNote: (book_id) => { location.hash = `/book/${book_id}/note`; },
  goAdd: () => { location.hash = '/add'; },
  goUpload: () => { location.hash = '/upload'; },
  goGenerate: (draft_id) => { location.hash = `/generate/${draft_id}`; },
  goDraft: (draft_id) => { location.hash = `/draft/${draft_id}`; },
  goSettings: () => { location.hash = '/settings'; }
};

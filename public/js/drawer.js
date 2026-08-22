// ---------- 设置抽屉：顶栏唯一的 ⚙ 入口，七个分区收纳全部杂项 ----------
import { $ } from './core.js';

const SECTION_NAMES = ['general', 'ai', 'persona', 'canon', 'history', 'admin', 'about'];
let current = 'general';

function drawer() { return $('settingsDrawer'); }

function showSection(name) {
  if (!SECTION_NAMES.includes(name)) name = 'general';
  current = name;
  for (const n of SECTION_NAMES) {
    const sec = $('drawer-' + n);
    if (sec) sec.hidden = n !== name;
  }
  document.querySelectorAll('.drawer-nav [data-section]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
}

export function openDrawer(section) {
  const el = drawer();
  if (!el) return;
  showSection(section || current);
  el.hidden = false;
}

export function closeDrawer() {
  const el = drawer();
  if (el) el.hidden = true;
}

export function isDrawerOpen() {
  const el = drawer();
  return !!el && !el.hidden;
}

export function initDrawer() {
  const el = drawer();
  if (!el) return;
  const closeBtn = $('settingsDrawerClose');
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  document.querySelectorAll('.drawer-nav [data-section]').forEach((btn) => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
  });
  // 点击抽屉外的遮罩区域关闭
  el.addEventListener('click', (e) => {
    if (e.target === el) closeDrawer();
  });
}

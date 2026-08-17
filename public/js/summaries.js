import { els, state } from './core.js';
import { toast } from './render.js';

// ---------- 总结历史 ----------
export async function fetchSummaries() {
  try {
    const res = await fetch('/api/summaries', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '读取总结失败');
    state.summaryData = { current: data.current || null, history: data.history || [] };
    renderSummaries();
  } catch (err) {
    toast(err.message || '读取总结失败');
  }
}

function renderSummaries() {
  renderCurrentSummary();
  renderSummaryList();
}

function renderCurrentSummary() {
  const box = els.summaryCurrent;
  box.innerHTML = '';
  const h = document.createElement('h4');
  h.textContent = '当前总结';
  box.appendChild(h);

  if (!state.summaryData.current) {
    const p = document.createElement('div');
    p.className = 'empty-votes';
    p.textContent = '暂无当前总结（自动闲聊积累到一定条数后会自动生成）。';
    box.appendChild(p);
    return;
  }

  const topic = document.createElement('div');
  topic.className = 'vote-hint';
  topic.textContent = '话题：' + (state.summaryData.current.topic || '自动闲聊');
  box.appendChild(topic);

  const ta = document.createElement('textarea');
  ta.value = state.summaryData.current.content || '';
  box.appendChild(ta);

  const save = document.createElement('button');
  save.className = 'btn small';
  save.type = 'button';
  save.textContent = '保存当前总结';
  save.addEventListener('click', async () => {
    await updateSummary(state.summaryData.current.id, ta.value);
  });
  box.appendChild(save);
}

function renderSummaryList() {
  const list = els.summaryList;
  list.innerHTML = '';
  const items = state.summaryData.history || [];
  if (!items.length) {
    const p = document.createElement('div');
    p.className = 'empty-votes';
    p.textContent = '还没有历史总结。';
    list.appendChild(p);
    return;
  }

  for (const s of items) {
    const item = document.createElement('div');
    item.className = 'vote-item summary-item';

    const head = document.createElement('div');
    head.className = 'summary-item-head';

    const label = document.createElement('span');
    label.className = 'vote-text';
    const isCurrent = state.summaryData.current && state.summaryData.current.id === s.id;
    const time = new Date(s.createdAt).toLocaleString('zh-CN', { hour12: false });
    label.textContent = (isCurrent ? '【当前】' : '') + (s.topic || '自动闲聊') + ' · ' + time;
    head.appendChild(label);

    const editBtn = document.createElement('button');
    editBtn.className = 'vote-btn';
    editBtn.type = 'button';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => {
      state.editingSummaryId = s.id;
      renderSummaryList();
    });
    head.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'vote-btn danger';
    delBtn.type = 'button';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', async () => {
      if (!confirm('确定删除这条总结？')) return;
      await deleteSummary(s.id);
    });
    head.appendChild(delBtn);
    item.appendChild(head);

    if (state.editingSummaryId === s.id) {
      const ta = document.createElement('textarea');
      ta.value = s.content || '';
      item.appendChild(ta);

      const save = document.createElement('button');
      save.className = 'btn small';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', async () => {
        await updateSummary(s.id, ta.value);
        state.editingSummaryId = null;
      });
      item.appendChild(save);

      const cancel = document.createElement('button');
      cancel.className = 'btn small ghost';
      cancel.type = 'button';
      cancel.textContent = '取消';
      cancel.addEventListener('click', () => {
        state.editingSummaryId = null;
        renderSummaryList();
      });
      item.appendChild(cancel);
    } else {
      const content = document.createElement('div');
      content.className = 'summary-content';
      content.textContent = s.content || '';
      item.appendChild(content);
    }

    list.appendChild(item);
  }
}

export async function updateSummary(id, content) {
  const res = await fetch('/api/summaries/' + encodeURIComponent(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(data.error || '保存失败');
    return;
  }
  state.summaryData = { current: data.current || null, history: data.history || [] };
  renderSummaries();
  toast('总结已保存');
}

export async function deleteSummary(id) {
  const res = await fetch('/api/summaries/' + encodeURIComponent(id), { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(data.error || '删除失败');
    return;
  }
  state.summaryData = { current: data.current || null, history: data.history || [] };
  if (state.editingSummaryId === id) state.editingSummaryId = null;
  renderSummaries();
  toast('总结已删除');
}

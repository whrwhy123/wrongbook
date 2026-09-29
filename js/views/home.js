/* ===== 首页：错题列表 ===== */
const Views = {};

Views.home = {
  state: { kw: '', subject: 'all', tag: 'all', status: 'all', questions: [], subjects: [] },

  async load() {
    this.state.subjects = await Store.getSubjects();
    this.state.questions = await Store.listQuestions();
  },

  subjectName(id) {
    if (!id) return '未分类';
    const s = this.state.subjects.find(x => x.id === id);
    return s ? s.name : '未分类';
  },

  allTags() {
    const set = new Set();
    const qs = this.state.questions.filter(q =>
      this.state.subject === 'all' || q.subject === this.state.subject);
    for (const q of qs) {
      if (q.tags) q.tags.forEach(t => set.add(t));
    }
    return Array.from(set);
  },

  filtered() {
    const { kw, subject, tag, status } = this.state;
    const kwLower = kw.trim().toLowerCase();
    return this.state.questions.filter(q => {
      if (subject !== 'all' && q.subject !== subject) return false;
      if (tag !== 'all' && !(q.tags || []).includes(tag)) return false;
      if (status === 'unmastered' && q.mastered) return false;
      if (status === 'mastered' && !q.mastered) return false;
      if (kwLower) {
        const hay = [q.stem, q.source, q.reason, q.analysis, (q.tags || []).join(' '), this.subjectName(q.subject)]
          .join(' ').toLowerCase();
        if (!hay.includes(kwLower)) return false;
      }
      return true;
    });
  },

  render(el) {
    const st = this.state;
    const tags = this.allTags();
    const list = this.filtered();

    const subjectChips = [{ id: 'all', name: '全部' }, ...st.subjects.map(s => ({ id: s.id, name: s.name }))]
      .map(s => `<button class="chip ${st.subject === s.id ? 'active' : ''}" data-subject="${App.esc(s.id)}">${App.esc(s.name)}</button>`).join('');

    const tagChips = [{ name: 'all', label: '全部知识点' }, ...tags.map(t => ({ name: t, label: t }))]
      .map(t => `<button class="chip chip-sm ${st.tag === t.name ? 'active' : ''}" data-tag="${App.esc(t.name)}">${App.esc(t.label)}</button>`).join('');

    el.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input class="input" id="kwInput" placeholder="搜索题干 / 知识点 / 来源" value="${App.esc(st.kw)}">
      </div>
      <div class="chips">${subjectChips}</div>
      <div class="chips">${tagChips}</div>
      <div class="chips">
        <button class="chip chip-sm ${st.status === 'all' ? 'active' : ''}" data-status="all">全部</button>
        <button class="chip chip-sm ${st.status === 'unmastered' ? 'active' : ''}" data-status="unmastered">未掌握</button>
        <button class="chip chip-sm ${st.status === 'mastered' ? 'active' : ''}" data-status="mastered">已掌握</button>
      </div>
      <div id="qList"></div>
    `;

    const listEl = el.querySelector('#qList');
    if (!list.length) {
      listEl.innerHTML = `
        <div class="empty">
          <span class="empty-icon">📖</span>
          <p>${st.questions.length ? '没有符合条件的错题' : '还没有错题，点右下角 + 记录第一道吧'}</p>
        </div>`;
    } else {
      listEl.innerHTML = list.map(q => this.cardHtml(q)).join('');
    }

    /* 事件绑定 */
    el.querySelector('#kwInput').addEventListener('input', e => {
      st.kw = e.target.value; this.render(el);
    });
    el.querySelectorAll('[data-subject]').forEach(b => b.onclick = () => { st.subject = b.dataset.subject; this.render(el); });
    el.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { st.tag = b.dataset.tag; this.render(el); });
    el.querySelectorAll('[data-status]').forEach(b => b.onclick = () => { st.status = b.dataset.status; this.render(el); });
    el.querySelectorAll('.q-card').forEach(card => {
      card.onclick = () => App.go('detail', { id: card.dataset.id });
    });
  },

  cardHtml(q) {
    const typeBadge = {
      single: '<span class="badge badge-single">单选</span>',
      subjective: '<span class="badge badge-subjective">主观</span>'
    }[q.type] || '';

    const tags = (q.tags || []).slice(0, 3)
      .map(t => `<span class="badge badge-subject">${App.esc(t)}</span>`).join(' ');

    const total = (q.correctCount || 0) + (q.wrongCount || 0);

    return `
      <div class="card q-card" data-id="${App.esc(q.id)}">
        <div class="q-card-head">
          ${typeBadge}
          <span class="badge badge-subject">${App.esc(this.subjectName(q.subject))}</span>
          ${q.mastered ? '<span class="badge badge-mastered">✓ 已掌握</span>' : ''}
          <span style="flex:1"></span>
          <span style="font-size:.74rem;color:var(--text-light)">${fmtDate(q.createdAt).slice(0, 10)}</span>
        </div>
        <div class="q-card-stem">${App.esc(q.stem)}</div>
        ${tags ? `<div class="q-card-meta" style="margin-bottom:2px;">${tags}</div>` : ''}
        <div class="q-card-meta">
          ${total > 0 ? `<span class="correct">✓ 对 ${q.correctCount || 0}</span><span class="wrong">✗ 错 ${q.wrongCount || 0}</span>` : '<span>尚未重做</span>'}
          ${q.source ? `<span>来源：${App.esc(q.source)}</span>` : ''}
        </div>
        ${q.reason ? `<div class="q-card-reason">错因：${App.esc(q.reason)}</div>` : ''}
      </div>`;
  }
};

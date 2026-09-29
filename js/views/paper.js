/* ===== 试卷：选题 → 生成试卷 → 手机作答 / 导出打印 ===== */
Views.paper = {
  /* 选题阶段状态 */
  pick: { subject: 'all', tag: 'all', onlyUnmastered: false, checked: new Set() },
  /* 试卷阶段状态 */
  doc: { questions: [], shown: new Set() },
  questions: [],
  subjects: [],

  async load() {
    this.subjects = await Store.getSubjects();
    this.questions = await Store.listQuestions();
  },

  subjectName(id) {
    if (!id) return '未分类';
    const s = this.subjects.find(x => x.id === id);
    return s ? s.name : '未分类';
  },

  pickTags() {
    const set = new Set();
    this.questions.forEach(q => {
      if (this.pick.subject !== 'all' && q.subject !== this.pick.subject) return;
      (q.tags || []).forEach(t => set.add(t));
    });
    return Array.from(set);
  },

  pickFiltered() {
    const { subject, tag, onlyUnmastered } = this.pick;
    return this.questions.filter(q => {
      if (subject !== 'all' && q.subject !== subject) return false;
      if (tag !== 'all' && !(q.tags || []).includes(tag)) return false;
      if (onlyUnmastered && q.mastered) return false;
      return true;
    });
  },

  render(el) {
    if (this.doc.questions.length) { this.renderPaper(el); return; }
    this.renderPick(el);
  },

  /* ---------- 阶段一：选题 ---------- */
  renderPick(el) {
    const pk = this.pick;
    const list = this.pickFiltered();

    /* 切换筛选后清理无效勾选 */
    const validIds = new Set(list.map(q => q.id));
    pk.checked = new Set([...pk.checked].filter(id => validIds.has(id)));

    const subChips = [{ id: 'all', name: '全部' }, ...this.subjects.map(s => ({ id: s.id, name: s.name }))]
      .map(s => `<button class="chip ${pk.subject === s.id ? 'active' : ''}" data-subject="${App.esc(s.id)}">${App.esc(s.name)}</button>`).join('');

    const tagChips = [{ name: 'all', label: '全部知识点' }, ...this.pickTags().map(t => ({ name: t, label: t }))]
      .map(t => `<button class="chip chip-sm ${pk.tag === t.name ? 'active' : ''}" data-tag="${App.esc(t.name)}">${App.esc(t.label)}</button>`).join('');

    const items = list.map(q => `
      <label class="paper-select-item">
        <input type="checkbox" data-id="${App.esc(q.id)}" ${pk.checked.has(q.id) ? 'checked' : ''}>
        <span style="flex:1;">
          <span style="display:flex;gap:6px;align-items:center;margin-bottom:3px;">
            <span class="badge badge-${q.type === 'single' ? 'single' : 'subjective'}">${TYPE_NAMES[q.type]}</span>
            <span class="badge badge-subject">${App.esc(this.subjectName(q.subject))}</span>
            ${q.mastered ? '<span class="badge badge-mastered">已掌握</span>' : ''}
          </span>
          <span style="font-size:.9rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${App.esc(q.stem)}</span>
        </span>
      </label>`).join('');

    el.innerHTML = `
      <div class="card">
        <div class="card-title">📝 选择错题组成试卷</div>
        <div class="chips">${subChips}</div>
        <div class="chips">${tagChips}</div>
        <div class="switch-row" style="border-bottom:none;padding:6px 0 2px;">
          <span class="sw-label">只看未掌握的错题</span>
          <label class="switch"><input type="checkbox" id="onlyUnmastered" ${pk.onlyUnmastered ? 'checked' : ''}><span class="slider"></span></label>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="font-weight:600;">共 ${list.length} 题，已选 <span id="selCount" style="color:var(--primary);">${pk.checked.size}</span> 题</span>
          <button class="btn btn-light btn-sm" id="btnSelAll">${pk.checked.size === list.length && list.length ? '取消全选' : '全选'}</button>
        </div>
        ${list.length ? items : '<div class="empty" style="padding:30px 10px;"><span class="empty-icon">📭</span><p>没有符合条件的错题</p></div>'}
      </div>
      <button class="btn btn-primary btn-block btn-lg" id="btnGen" ${pk.checked.size ? '' : 'disabled'}>生成试卷（${pk.checked.size} 题）</button>
      <div class="form-hint" style="text-align:center;margin-top:8px;">试卷生成后可手机作答，也可导出 Word 打印</div>
    `;

    el.querySelectorAll('[data-subject]').forEach(b => b.onclick = () => {
      pk.subject = b.dataset.subject; this.render(el);
    });
    el.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => {
      pk.tag = b.dataset.tag; this.render(el);
    });
    el.querySelector('#onlyUnmastered').onchange = e => {
      pk.onlyUnmastered = e.target.checked; this.render(el);
    };
    el.querySelectorAll('input[data-id]').forEach(cb => cb.onchange = () => {
      if (cb.checked) pk.checked.add(cb.dataset.id);
      else pk.checked.delete(cb.dataset.id);
      el.querySelector('#selCount').textContent = pk.checked.size;
      el.querySelector('#btnGen').disabled = !pk.checked.size;
      el.querySelector('#btnGen').textContent = `生成试卷（${pk.checked.size} 题）`;
    });
    el.querySelector('#btnSelAll').onclick = () => {
      if (pk.checked.size === list.length && list.length) pk.checked.clear();
      else list.forEach(q => pk.checked.add(q.id));
      this.render(el);
    };
    el.querySelector('#btnGen').onclick = () => {
      this.doc.questions = this.questions.filter(q => pk.checked.has(q.id));
      this.doc.shown = new Set();
      App.setTitle(`试卷 · ${this.doc.questions.length} 题`);
      this.render(el);
    };
  },

  /* ---------- 阶段二：试卷作答 ---------- */
  renderPaper(el) {
    const { questions, shown } = this.doc;
    const showAll = shown.size === questions.length && questions.length;
    App.setTitle(`试卷 · ${questions.length} 题`);

    const qHtml = questions.map((q, i) => {
      const isShown = shown.has(q.id);
      const optionsHtml = q.type !== 'subjective' && q.options
        ? `<div class="paper-q-options">${q.options.map(o =>
            `<div class="option-line"><b>${App.esc(o.key)}.</b> ${App.esc(o.text)}</div>`).join('')}</div>`
        : '';

      const answerHtml = isShown ? `
        <div class="answer-box" style="margin:10px 14px;">
          <div class="answer-line"><b>正确答案：</b>${App.esc(q.answer || '（未填写）')}</div>
          ${q.wrongAnswer ? `<div class="answer-line answer-wrong"><b>我的错答：</b>${App.esc(q.wrongAnswer)}</div>` : ''}
          ${q.reason ? `<div class="answer-line answer-reason"><b>错因：</b>${App.esc(q.reason)}</div>` : ''}
          ${q.analysis ? `<div class="answer-line answer-analysis"><b>解析：</b><span style="white-space:pre-wrap;">${App.esc(q.analysis)}</span></div>` : ''}
          ${q.tags && q.tags.length ? `<div class="answer-line"><b>知识点：</b>${App.esc(q.tags.join('、'))}</div>` : ''}
        </div>
        <div class="paper-q-foot">
          <button class="btn btn-green btn-sm" data-result="1" data-id="${App.esc(q.id)}">✓ 这次做对了</button>
          <button class="btn btn-red btn-sm" data-result="0" data-id="${App.esc(q.id)}">✗ 这次做错了</button>
        </div>` : '';

      return `
        <div class="card paper-q">
          <div class="paper-q-head">
            <span class="paper-q-no">${i + 1}.</span>
            <div>
              <div class="paper-q-stem">${App.esc(q.stem)}</div>
              ${q.type === 'subjective' ? '<div class="underline-space"><div class="line"></div><div class="line"></div><div class="line"></div></div>' : ''}
            </div>
          </div>
          ${optionsHtml}
          ${isShown
            ? answerHtml
            : `<div class="paper-q-foot" style="border-top:1px dashed var(--border);">
                 <button class="btn btn-light btn-sm" data-show="${App.esc(q.id)}">👁 显示答案与错因</button>
               </div>`}
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="paper-bar">
        <button class="btn btn-light btn-sm" id="btnBackPick">← 重新选题</button>
        <button class="btn btn-light btn-sm" id="btnToggleAll">${showAll ? '隐藏全部答案' : '显示全部答案'}</button>
        <button class="btn btn-primary btn-sm" id="btnExport" style="margin-left:auto;">⬇ 导出打印</button>
      </div>
      <div style="font-size:.82rem;color:var(--text-light);text-align:center;margin-bottom:10px;">
        共 ${questions.length} 题 · 先自己作答，再点开答案核对错因
      </div>
      ${questions.length ? qHtml : '<div class="empty"><span class="empty-icon">📭</span><p>试卷为空</p></div>'}
      ${questions.length ? `<button class="btn btn-primary btn-block btn-lg" id="btnExport2">⬇ 导出 Word 打印版（题目卷＋答案卷）</button>` : ''}
    `;

    /* 显示单题答案 */
    el.querySelectorAll('[data-show]').forEach(b => b.onclick = () => {
      this.doc.shown.add(b.dataset.show);
      this.render(el);
    });
    /* 记录做对做错 */
    el.querySelectorAll('[data-result]').forEach(b => b.onclick = async () => {
      const correct = b.dataset.result === '1';
      await Store.recordPractice(b.dataset.id, correct);
      App.toast(correct ? '已记录：做对 ✓' : '已记录：做错 ✗（继续加油）');
    });
    el.querySelector('#btnToggleAll').onclick = () => {
      if (showAll) this.doc.shown.clear();
      else questions.forEach(q => this.doc.shown.add(q.id));
      this.render(el);
    };
    el.querySelector('#btnBackPick').onclick = () => {
      this.doc.questions = [];
      this.doc.shown = new Set();
      App.setTitle('试卷');
      this.render(el);
    };
    el.querySelector('#btnExport').onclick = () => this.doExport();
    const exp2 = el.querySelector('#btnExport2');
    if (exp2) exp2.onclick = () => this.doExport();
  },

  async doExport() {
    try {
      exportPaperDoc(this.doc.questions, '考编·高中政治错题重做卷');
      App.toast('已导出 Word，可在下载中查看并打印');
    } catch (e) {
      App.toast(e.message || '导出失败');
    }
  }
};

/* ===== 添加 / 编辑错题 ===== */
Views.add = {
  /* 表单状态 */
  f: null,

  async init(editId) {
    const subjects = await Store.getSubjects();
    const tags = await Store.getTags();
    if (editId) {
      const q = await Store.getQuestion(editId);
      if (!q) throw new Error('错题不存在');
      this.f = {
        id: q.id,
        subject: q.subject || '',
        type: q.type || 'single',
        stem: q.stem || '',
        options: q.options && q.options.length ? JSON.parse(JSON.stringify(q.options)) : this.defaultOptions(),
        answer: q.answer || '',
        wrongAnswer: q.wrongAnswer || '',
        reason: q.reason || '',
        analysis: q.analysis || '',
        tags: q.tags ? [...q.tags] : [],
        source: q.source || '',
        createdAt: q.createdAt,
      };
    } else {
      this.f = {
        id: null,
        subject: subjects.length ? subjects[0].id : '',
        type: 'single',
        stem: '',
        options: this.defaultOptions(),
        answer: '',
        wrongAnswer: '',
        reason: '',
        analysis: '',
        tags: [],
        source: '',
        createdAt: null,
      };
    }
    this.subjects = subjects;
    this.allTags = tags;
  },

  defaultOptions() {
    return [
      { key: 'A', text: '' }, { key: 'B', text: '' },
      { key: 'C', text: '' }, { key: 'D', text: '' }
    ];
  },

  /* 读取表单值（题型由按钮切换时已写入 f.type，此处不再读取） */
  readForm() {
    const f = this.f;
    f.subject = document.querySelector('#fSubject').value;
    f.stem = document.querySelector('#fStem').value.trim();
    f.reason = document.querySelector('#fReason').value.trim();
    f.analysis = document.querySelector('#fAnalysis').value.trim();
    f.source = document.querySelector('#fSource').value.trim();

    /* 选项 */
    f.options = [];
    document.querySelectorAll('#optList .option-row').forEach(row => {
      const key = row.querySelector('.option-key').textContent.trim();
      const text = row.querySelector('input').value.trim();
      if (text) f.options.push({ key, text });
    });

    /* 答案与错答 */
    if (f.type === 'single') {
      f.answer = document.querySelector('input[name="fAnswer"]:checked')?.value || '';
      f.wrongAnswer = document.querySelector('input[name="fWrong"]:checked')?.value || '';
    } else if (f.type === 'multiple') {
      f.answer = Array.from(document.querySelectorAll('input[name="fAnswerM"]:checked')).map(i => i.value).sort().join('');
      f.wrongAnswer = Array.from(document.querySelectorAll('input[name="fWrongM"]:checked')).map(i => i.value).sort().join('');
    } else {
      f.answer = document.querySelector('#fAnswerText').value.trim();
      f.wrongAnswer = document.querySelector('#fWrongText').value.trim();
    }

    /* 标签 */
    f.tags = Array.from(document.querySelectorAll('#tagSel .chip.active')).map(c => c.dataset.tagName);
    const newTag = document.querySelector('#newTagInput').value.trim();
    if (newTag) f.tags.push(newTag);
    f.tags = Array.from(new Set(f.tags));
  },

  validate() {
    const f = this.f;
    if (!f.stem) { App.toast('请填写题干'); return false; }
    if (f.type !== 'subjective') {
      if (f.options.length < 2) { App.toast('选择题至少需要 2 个选项'); return false; }
      if (!f.answer) { App.toast('请选择正确答案'); return false; }
      const keys = f.options.map(o => o.key);
      if (f.type === 'multiple' && f.answer.split('').some(k => !keys.includes(k))) {
        App.toast('正确答案与选项不符'); return false;
      }
    } else {
      if (!f.answer) { App.toast('请填写参考答案'); return false; }
    }
    if (!f.reason && !f.analysis) {
      App.toast('建议至少填写错因或解析，方便日后复习');
    }
    return true;
  },

  async save() {
    this.readForm();
    if (!this.validate()) return;
    /* 新建标签入库 */
    const newTags = this.f.tags.filter(t => !this.allTags.some(x => x.name === t));
    for (const t of newTags) {
      try { this.allTags.push(await Store.addTag(t)); } catch (e) { /* 已存在则跳过 */ }
    }
    const base = this.f.id ? await Store.getQuestion(this.f.id) : null;
    const q = {
      id: this.f.id,
      subject: this.f.subject,
      type: this.f.type,
      stem: this.f.stem,
      options: this.f.type === 'subjective' ? [] : this.f.options,
      answer: this.f.answer,
      wrongAnswer: this.f.wrongAnswer,
      reason: this.f.reason,
      analysis: this.f.analysis,
      tags: this.f.tags,
      source: this.f.source,
      createdAt: base ? base.createdAt : Date.now(),
      correctCount: base ? (base.correctCount || 0) : 0,
      wrongCount: base ? (base.wrongCount || 0) : 0,
      mastered: base ? !!base.mastered : false,
      masteredAt: base ? (base.masteredAt || null) : null,
      lastResult: base ? (base.lastResult ?? null) : null,
    };
    if (this.f.id) await Store.updateQuestion(q);
    else await Store.addQuestion(q);
    App.toast('已保存 ✓');
    App.go('home');
  },

  render(el) {
    const f = this.f;
    const subOptions = [{ id: '', name: '未分类' }, ...this.subjects.map(s => ({ id: s.id, name: s.name }))]
      .map(s => `<option value="${App.esc(s.id)}" ${f.subject === s.id ? 'selected' : ''}>${App.esc(s.name)}</option>`).join('');

    el.innerHTML = `
      <div class="card">
        <div class="form-item">
          <label class="form-label">题型</label>
          <div class="type-switch">
            <button type="button" class="type-btn ${f.type === 'single' ? 'active' : ''}" data-type="single">单选题</button>
            <button type="button" class="type-btn ${f.type === 'multiple' ? 'active' : ''}" data-type="multiple">多选题</button>
            <button type="button" class="type-btn ${f.type === 'subjective' ? 'active' : ''}" data-type="subjective">主观题</button>
          </div>
        </div>
        <div class="form-item">
          <label class="form-label">科目<span class="req">*</span></label>
          <select class="select" id="fSubject">${subOptions}</select>
        </div>
        <div class="form-item">
          <label class="form-label">题干<span class="req">*</span></label>
          <textarea class="textarea" id="fStem" placeholder="粘贴或输入题目内容">${App.esc(f.stem)}</textarea>
        </div>
        <div id="optArea"></div>
        <div class="form-item">
          <label class="form-label">错因分析</label>
          <textarea class="textarea" id="fReason" placeholder="例如：混淆了主要矛盾和矛盾的主要方面">${App.esc(f.reason)}</textarea>
        </div>
        <div class="form-item">
          <label class="form-label">答案解析</label>
          <textarea class="textarea" id="fAnalysis" placeholder="正确的解题思路、涉及的知识点">${App.esc(f.analysis)}</textarea>
        </div>
        <div class="form-item">
          <label class="form-label">知识点标签</label>
          <div class="chips" id="tagSel" style="flex-wrap:wrap;">
            ${this.allTags.map(t =>
              `<button type="button" class="chip chip-sm ${f.tags.includes(t.name) ? 'active' : ''}" data-tag-name="${App.esc(t.name)}">${App.esc(t.name)}</button>`
            ).join('')}
          </div>
          <input class="input" id="newTagInput" placeholder="＋ 输入新知识点标签，如：教学设计" style="margin-top:6px;">
        </div>
        <div class="form-item">
          <label class="form-label">来源（可选）</label>
          <input class="input" id="fSource" placeholder="如：2024年某市教师招聘真题 / 某模拟卷" value="${App.esc(f.source)}">
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px;">
        <button class="btn btn-gray" id="btnCancel" style="flex:1;">取消</button>
        <button class="btn btn-primary" id="btnSave" style="flex:2;">保存错题</button>
      </div>
    `;

    this.renderOptions(el.querySelector('#optArea'));

    /* 题型切换 */
    el.querySelectorAll('.type-btn').forEach(b => b.onclick = () => {
      this.readForm();
      const oldType = f.type;
      f.type = b.dataset.type;
      if (f.type === 'subjective' && oldType !== 'subjective' && !f.answer) f.answer = '';
      this.render(el);
    });

    /* 标签选择 */
    el.querySelector('#tagSel').addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      const name = btn.dataset.tagName;
      const idx = f.tags.indexOf(name);
      if (idx >= 0) f.tags.splice(idx, 1); else f.tags.push(name);
      btn.classList.toggle('active');
    });

    el.querySelector('#btnCancel').onclick = () => App.go('home');
    el.querySelector('#btnSave').onclick = () => this.save();
  },

  renderOptions(area) {
    const f = this.f;
    if (f.type === 'subjective') {
      area.innerHTML = `
        <div class="form-item">
          <label class="form-label">参考答案<span class="req">*</span></label>
          <textarea class="textarea" id="fAnswerText" placeholder="标准答案 / 得分要点">${App.esc(f.answer)}</textarea>
        </div>
        <div class="form-item">
          <label class="form-label">我当时怎么答的（可选）</label>
          <textarea class="textarea" id="fWrongText" placeholder="记录你当时的作答，方便对比差距">${App.esc(f.wrongAnswer)}</textarea>
        </div>`;
      return;
    }

    const optionRows = f.options.map(o => {
      const isAns = f.type === 'single' ? f.answer === o.key : f.answer.includes(o.key);
      const isWrong = f.type === 'single' ? f.wrongAnswer === o.key : f.wrongAnswer.includes(o.key);
      const ansName = f.type === 'single' ? 'fAnswer' : 'fAnswerM';
      const wrongName = f.type === 'single' ? 'fWrong' : 'fWrongM';
      return `
        <div class="option-row" data-key="${App.esc(o.key)}">
          <span class="option-key ${isAns ? 'correct' : ''}">${App.esc(o.key)}</span>
          <input class="input" placeholder="选项内容" value="${App.esc(o.text)}">
          <label class="option-check" title="标记为正确答案" style="display:flex;align-items:center;justify-content:center;">
            <input type="${f.type === 'single' ? 'radio' : 'checkbox'}" name="${ansName}" value="${App.esc(o.key)}" ${isAns ? 'checked' : ''}
              style="width:18px;height:18px;accent-color:var(--green);">
          </label>
          <button type="button" class="option-del" title="删除选项">✕</button>
        </div>`;
    }).join('');

    const wrongRows = f.options.map(o => {
      const isWrong = f.type === 'single' ? f.wrongAnswer === o.key : f.wrongAnswer.includes(o.key);
      const wrongName = f.type === 'single' ? 'fWrong' : 'fWrongM';
      return `
        <label class="option-row" style="cursor:pointer;">
          <input type="${f.type === 'single' ? 'radio' : 'checkbox'}" name="${wrongName}" value="${App.esc(o.key)}" ${isWrong ? 'checked' : ''}
            style="width:18px;height:18px;accent-color:var(--red);flex-shrink:0;">
          <span style="font-size:.85rem;color:var(--text-sub);">${App.esc(o.key)}. ${App.esc(o.text) || '（未填写）'}</span>
        </label>`;
    }).join('');

    area.innerHTML = `
      <div class="form-item">
        <label class="form-label">选项与正确答案<span class="req">*</span>
          <span class="form-hint" style="font-weight:400;">点选项前的字母框，绿色＝正确答案</span>
        </label>
        <div id="optList">${optionRows}</div>
        ${f.options.length < 8 ? '<button type="button" class="btn btn-light btn-sm" id="btnAddOpt">＋ 添加选项</button>' : ''}
      </div>
      <div class="form-item">
        <label class="form-label">我当时错选了哪些（可选）</label>
        <div>${wrongRows}</div>
      </div>`;

    /* 选项文本输入 */
    area.querySelectorAll('#optList .option-row').forEach(row => {
      const key = row.dataset.key;
      row.querySelector('input.input').addEventListener('input', e => {
        const opt = f.options.find(o => o.key === key);
        if (opt) opt.text = e.target.value;
      });
      /* 正确答案勾选 */
      row.querySelector('input[name="fAnswer"],input[name="fAnswerM"]').addEventListener('change', e => {
        f.answer = e.target.value;
        row.querySelector('.option-key').classList.toggle('correct', e.target.checked);
        if (f.type === 'multiple') {
          /* 多选时同步刷新 answer 汇总 */
          const keys = Array.from(area.querySelectorAll('input[name="fAnswerM"]:checked')).map(i => i.value);
          f.answer = keys.sort().join('');
        }
      });
      /* 删除选项 */
      row.querySelector('.option-del').onclick = () => {
        f.options = f.options.filter(o => o.key !== key);
        f.options.forEach((o, i) => { o.key = String.fromCharCode(65 + i); });
        f.answer = ''; f.wrongAnswer = '';
        this.render(document.getElementById('main'));
      };
    });

    /* 添加选项 */
    const addBtn = area.querySelector('#btnAddOpt');
    if (addBtn) addBtn.onclick = () => {
      f.options.push({ key: String.fromCharCode(65 + f.options.length), text: '' });
      this.render(document.getElementById('main'));
    };
  }
};

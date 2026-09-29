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
        images: q.images ? [...q.images] : [],
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
        images: [],
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

    /* 答案与错答：单选由字母按钮 / 错答 chips 直接写入 f，此处无需读取；主观读文本框 */
    if (f.type === 'subjective') {
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
    if (!f.stem && !(f.images && f.images.length)) { App.toast('请填写题干，或贴上题目图片'); return false; }
    if (f.type !== 'subjective') {
      if (f.options.length < 2) { App.toast('选择题至少需要 2 个选项'); return false; }
      if (!f.answer) { App.toast('请选择正确答案'); return false; }
      const keys = f.options.map(o => o.key);
      if (!keys.includes(f.answer)) {
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
      images: [...(this.f.images || [])],
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
            <button type="button" class="type-btn ${f.type === 'subjective' ? 'active' : ''}" data-type="subjective">主观题</button>
          </div>
        </div>
        <div class="form-item">
          <label class="form-label">科目<span class="req">*</span></label>
          <select class="select" id="fSubject">${subOptions}</select>
        </div>
        <div class="form-item">
          <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;">
            <span>题干</span>
            <span style="display:flex;gap:6px;">
              <button type="button" class="btn btn-light btn-sm" id="btnCam">📷 拍照</button>
              <button type="button" class="btn btn-light btn-sm" id="btnPic">🖼 相册</button>
            </span>
          </label>
          <textarea class="textarea" id="fStem" placeholder="输入题目内容；也可直接拍照 / 从相册贴题目图片">${App.esc(f.stem)}</textarea>
          <div class="img-thumbs" id="imgThumbs"></div>
          <div class="form-hint">贴图后题干可不填；点缩略图看大图，点 ✕ 移除</div>
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
    this.renderThumbs();

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

    /* 拍照 / 相册：每次点击动态创建 input，兼容主屏幕（PWA 独立窗口）模式 */
    el.querySelector('#btnCam').onclick = () => this.pickImage(true);
    el.querySelector('#btnPic').onclick = () => this.pickImage(false);
  },

  /* 动态创建文件选择器（部分浏览器主屏幕模式下静态 input 点不开） */
  pickImage(capture) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files && input.files[0];
      input.remove();
      if (file) this.attachFile(file);
    };
    /* 用户取消选择时清理节点 */
    setTimeout(() => { if (document.body.contains(input)) input.remove(); }, 120000);
    input.click();
  },

  async attachFile(file) {
    try {
      App.toast('图片处理中…', 1500);
      const dataUrl = await App.fileToJpeg(file);
      const rec = await Store.addImage(dataUrl);
      this.f.images.push(rec.id);
      this.renderThumbs();
      App.toast('已添加题目图片 ✓');
    } catch (e) {
      App.toast(e.message || '图片添加失败');
    }
  },

  /* 缩略图预览区 */
  renderThumbs() {
    const box = document.querySelector('#imgThumbs');
    if (!box) return;
    const ids = this.f.images || [];
    box.innerHTML = ids.map(id => `
      <div class="img-thumb">
        <img data-imgid="${App.esc(id)}" alt="题目图片">
        <button type="button" class="del" data-del-img="${App.esc(id)}" title="移除">✕</button>
      </div>`).join('');
    App.bindImages(box);
    box.querySelectorAll('[data-del-img]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const id = b.dataset.delImg;
      this.f.images = this.f.images.filter(x => x !== id);
      try { await Store.deleteImage(id); } catch (err) {}
      this.renderThumbs();
    });
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
      const isAns = f.answer === o.key;
      return `
        <div class="option-row" data-key="${App.esc(o.key)}">
          <button type="button" class="option-key ${isAns ? 'correct' : ''}" data-ans="${App.esc(o.key)}"
            title="点一下设为正确答案">${App.esc(o.key)}</button>
          <input class="input" placeholder="选项内容" value="${App.esc(o.text)}">
          <button type="button" class="option-del" title="删除选项">✕</button>
        </div>`;
    }).join('');

    const wrongChips = f.options.map(o => `
      <button type="button" class="chip chip-sm ${f.wrongAnswer === o.key ? 'active' : ''}"
        data-wrong="${App.esc(o.key)}" style="${f.wrongAnswer === o.key ? 'background:var(--red);color:#fff;' : ''}">${App.esc(o.key)}</button>`).join('');

    area.innerHTML = `
      <div class="form-item">
        <label class="form-label">选项与正确答案<span class="req">*</span>
          <span class="form-hint" style="font-weight:400;">点字母设为正确答案（变绿），再点取消</span>
        </label>
        <div id="optList">${optionRows}</div>
        ${f.options.length < 8 ? '<button type="button" class="btn btn-light btn-sm" id="btnAddOpt">＋ 添加选项</button>' : ''}
      </div>
      <div class="form-item">
        <label class="form-label">我当时错选成 <span class="form-hint" style="font-weight:400;">可选：点字母记下你当时选错的选项，再点取消</span></label>
        <div class="chips" id="wrongChips">${wrongChips || '<span class="form-hint">添加选项后可标记</span>'}</div>
      </div>`;

    /* 选项文本输入 */
    area.querySelectorAll('#optList .option-row').forEach(row => {
      const key = row.dataset.key;
      row.querySelector('input.input').addEventListener('input', e => {
        const opt = f.options.find(o => o.key === key);
        if (opt) opt.text = e.target.value;
      });
      /* 点字母 = 标记 / 取消正确答案 */
      row.querySelector('[data-ans]').onclick = () => {
        f.answer = (f.answer === key) ? '' : key;
        area.querySelectorAll('#optList .option-key').forEach(k =>
          k.classList.toggle('correct', k.dataset.ans === f.answer));
      };
      /* 删除选项 */
      row.querySelector('.option-del').onclick = () => {
        f.options = f.options.filter(o => o.key !== key);
        f.options.forEach((o, i) => { o.key = String.fromCharCode(65 + i); });
        f.answer = ''; f.wrongAnswer = '';
        this.render(document.getElementById('main'));
      };
    });

    /* 错答 chips：点选 / 取消 */
    area.querySelectorAll('#wrongChips [data-wrong]').forEach(c => c.onclick = () => {
      const key = c.dataset.wrong;
      f.wrongAnswer = (f.wrongAnswer === key) ? '' : key;
      area.querySelectorAll('#wrongChips [data-wrong]').forEach(x => {
        const on = x.dataset.wrong === f.wrongAnswer;
        x.classList.toggle('active', on);
        x.style.background = on ? 'var(--red)' : '';
        x.style.color = on ? '#fff' : '';
      });
    });

    /* 添加选项 */
    const addBtn = area.querySelector('#btnAddOpt');
    if (addBtn) addBtn.onclick = () => {
      f.options.push({ key: String.fromCharCode(65 + f.options.length), text: '' });
      this.render(document.getElementById('main'));
    };
  }
};

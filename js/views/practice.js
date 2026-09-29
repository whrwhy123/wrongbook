/* ===== 随机抽题练习 / 单题重做 ===== */
Views.practice = {
  cfg: { subject: 'all', type: 'all', count: 10, onlyUnmastered: true },
  /* 一轮练习状态 */
  run: null, /* { questions, idx, results: [{correct}], mode } */

  async startSingle(qid) {
    const q = await Store.getQuestion(qid);
    if (!q) { App.toast('错题不存在'); return; }
    this.run = { questions: [q], idx: 0, results: [], mode: 'single' };
    App.go('practice', { running: true });
  },

  async startRound() {
    const cfg = this.cfg;
    let pool = await Store.listQuestions();
    if (cfg.subject !== 'all') pool = pool.filter(q => q.subject === cfg.subject);
    if (cfg.type !== 'all') pool = pool.filter(q => q.type === cfg.type);
    if (cfg.onlyUnmastered) pool = pool.filter(q => !q.mastered);
    if (!pool.length) {
      App.toast(cfg.onlyUnmastered ? '没有未掌握的错题了，真棒！' : '没有符合条件的错题');
      return;
    }
    /* 随机打乱 */
    pool = pool.sort(() => Math.random() - 0.5);
    const n = cfg.count === 0 ? pool.length : Math.min(cfg.count, pool.length);
    this.run = { questions: pool.slice(0, n), idx: 0, results: [], mode: 'round' };
    App.go('practice', { running: true });
  },

  render(el) {
    if (this.run) { this.renderRun(el); return; }
    this.renderConfig(el);
  },

  /* ---------- 配置 ---------- */
  async renderConfig(el) {
    const cfg = this.cfg;
    const subjects = await Store.getSubjects();
    const stats = await Store.stats();

    const subOpts = [{ id: 'all', name: '全部科目' }, ...subjects.map(s => ({ id: s.id, name: s.name }))]
      .map(s => `<option value="${App.esc(s.id)}" ${cfg.subject === s.id ? 'selected' : ''}>${App.esc(s.name)}</option>`).join('');

    const countOpts = [5, 10, 15, 20, 0]
      .map(n => `<option value="${n}" ${cfg.count === n ? 'selected' : ''}>${n === 0 ? '全部' : n + ' 题'}</option>`).join('');

    el.innerHTML = `
      <div class="stat-row">
        <div class="stat-box"><div class="num">${stats.total}</div><div class="lbl">错题总数</div></div>
        <div class="stat-box green"><div class="num">${stats.mastered}</div><div class="lbl">已掌握</div></div>
        <div class="stat-box orange"><div class="num">${stats.total - stats.mastered}</div><div class="lbl">待攻克</div></div>
      </div>
      <div class="card">
        <div class="card-title">🎯 随机抽题练习</div>
        <div class="form-item">
          <label class="form-label">科目</label>
          <select class="select" id="cfgSubject">${subOpts}</select>
        </div>
        <div class="form-item">
          <label class="form-label">题型</label>
          <div class="type-switch">
            <button type="button" class="type-btn ${cfg.type === 'all' ? 'active' : ''}" data-type="all">全部</button>
            <button type="button" class="type-btn ${cfg.type === 'single' ? 'active' : ''}" data-type="single">单选</button>
            <button type="button" class="type-btn ${cfg.type === 'multiple' ? 'active' : ''}" data-type="multiple">多选</button>
            <button type="button" class="type-btn ${cfg.type === 'subjective' ? 'active' : ''}" data-type="subjective">主观</button>
          </div>
        </div>
        <div class="form-item">
          <label class="form-label">题目数量</label>
          <select class="select" id="cfgCount">${countOpts}</select>
        </div>
        <div class="switch-row" style="border-bottom:none;padding-bottom:0;">
          <span class="sw-label">只抽未掌握的错题</span>
          <label class="switch"><input type="checkbox" id="cfgUnmastered" ${cfg.onlyUnmastered ? 'checked' : ''}><span class="slider"></span></label>
        </div>
      </div>
      <button class="btn btn-primary btn-block btn-lg" id="btnStart">开始练习</button>
      ${stats.rate !== null && stats.practiced > 0 ? `
        <div class="form-hint" style="text-align:center;margin-top:10px;">
          历史重做正确率：<b style="color:var(--green);">${stats.rate}%</b>（共练习 ${stats.practiced} 道）
        </div>` : ''}
    `;

    el.querySelector('#cfgSubject').onchange = e => { cfg.subject = e.target.value; };
    el.querySelector('#cfgCount').onchange = e => { cfg.count = Number(e.target.value); };
    el.querySelector('#cfgUnmastered').onchange = e => { cfg.onlyUnmastered = e.target.checked; };
    el.querySelectorAll('.type-btn').forEach(b => b.onclick = () => {
      cfg.type = b.dataset.type; this.render(el);
    });
    el.querySelector('#btnStart').onclick = () => this.startRound();
  },

  /* ---------- 答题 ---------- */
  curQuestion() {
    return this.run.questions[this.run.idx];
  },

  renderRun(el) {
    const run = this.run;
    if (run.idx >= run.questions.length) { this.renderResult(el); return; }
    const q = run.questions[run.idx];
    const total = run.questions.length;
    const idx = run.idx;
    const answered = run.results[idx];

    let answerArea = '';
    if (answered !== undefined) {
      /* 已作答：显示判定与解析 */
      const correct = answered.correct;
      answerArea = `
        <div class="result-banner ${correct ? 'right' : 'wrong'}">${correct ? '✅ 回答正确！' : '❌ 回答错误'}</div>
        <div class="answer-box">
          <div class="answer-line"><b>正确答案：</b>${App.esc(q.answer || '')}</div>
          ${q.reason ? `<div class="answer-line answer-reason"><b>错因：</b>${App.esc(q.reason)}</div>` : ''}
          ${q.analysis ? `<div class="answer-line answer-analysis"><b>解析：</b><span style="white-space:pre-wrap;">${App.esc(q.analysis)}</span></div>` : ''}
          ${q.tags && q.tags.length ? `<div class="answer-line"><b>知识点：</b>${App.esc(q.tags.join('、'))}</div>` : ''}
        </div>
        <button class="btn btn-primary btn-block btn-lg" id="btnNext" style="margin-top:14px;">
          ${idx + 1 < total ? '下一题 →' : '查看本轮结果'}
        </button>`;
    } else if (q.type === 'subjective') {
      answerArea = `
        <div class="underline-space"><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div>
        <div style="display:flex;gap:10px;margin-top:14px;">
          <button class="btn btn-light" id="btnShowAns" style="flex:1;">👁 查看答案</button>
        </div>
        <div id="subJudge" style="display:none;">
          <div class="answer-box">
            <div class="answer-line"><b>参考答案：</b><span style="white-space:pre-wrap;">${App.esc(q.answer || '')}</span></div>
            ${q.analysis ? `<div class="answer-line answer-analysis"><b>解析：</b><span style="white-space:pre-wrap;">${App.esc(q.analysis)}</span></div>` : ''}
            ${q.tags && q.tags.length ? `<div class="answer-line"><b>知识点：</b>${App.esc(q.tags.join('、'))}</div>` : ''}
          </div>
          <div style="display:flex;gap:10px;margin-top:12px;">
            <button class="btn btn-green" id="btnSelfRight" style="flex:1;">✓ 我做对了</button>
            <button class="btn btn-red" id="btnSelfWrong" style="flex:1;">✗ 我做错了</button>
          </div>
        </div>`;
    } else {
      /* 选择题作答区 */
      const optionsHtml = (q.options || []).map(o => `
        <button class="option-answer" data-key="${App.esc(o.key)}">
          <span class="opt-key">${App.esc(o.key)}.</span><span>${App.esc(o.text)}</span>
        </button>`).join('');
      const confirmBtn = q.type === 'multiple'
        ? `<button class="btn btn-primary btn-block" id="btnSubmit">提交答案</button>`
        : '';
      answerArea = `<div style="margin-top:12px;">${optionsHtml}${confirmBtn}</div>`;
    }

    const progress = Math.round(idx / total * 100);
    el.innerHTML = `
      <div class="progress-track"><div class="progress-fill" style="width:${progress}%;"></div></div>
      <div style="font-size:.82rem;color:var(--text-light);margin-bottom:10px;">
        第 ${idx + 1} / ${total} 题 · <span class="badge badge-${q.type === 'single' ? 'single' : q.type === 'multiple' ? 'multiple' : 'subjective'}">${TYPE_NAMES[q.type]}</span>
        <span class="badge badge-subject">${App.esc(Views.home.subjectName(q.subject))}</span>
      </div>
      <div class="card">
        <div style="font-size:1rem;white-space:pre-wrap;word-break:break-word;line-height:1.7;">${App.esc(q.stem)}</div>
        ${answerArea}
      </div>
      ${q.type === 'multiple' && answered === undefined ? '<div class="form-hint" style="text-align:center;">多选题：点击选中选项，再次点击取消，最后提交</div>' : ''}
    `;

    if (answered !== undefined) {
      el.querySelector('#btnNext').onclick = () => {
        run.idx++;
        this.render(el);
      };
      return;
    }

    if (q.type === 'subjective') {
      el.querySelector('#btnShowAns').onclick = () => {
        el.querySelector('#btnShowAns').style.display = 'none';
        el.querySelector('#subJudge').style.display = 'block';
      };
      el.querySelector('#btnSelfRight').onclick = () => this.judge(true, el);
      el.querySelector('#btnSelfWrong').onclick = () => this.judge(false, el);
      return;
    }

    /* 选择题 */
    const optBtns = el.querySelectorAll('.option-answer');
    const selected = new Set();
    optBtns.forEach(b => b.onclick = () => {
      if (q.type === 'single') {
        optBtns.forEach(x => x.classList.remove('selected'));
        selected.clear();
        b.classList.add('selected');
        selected.add(b.dataset.key);
        this.judgeChoice(q, selected, el);
      } else {
        b.classList.toggle('selected');
        if (selected.has(b.dataset.key)) selected.delete(b.dataset.key);
        else selected.add(b.dataset.key);
      }
    });
    const submitBtn = el.querySelector('#btnSubmit');
    if (submitBtn) submitBtn.onclick = () => this.judgeChoice(q, selected, el);
  },

  async judgeChoice(q, selected, el) {
    if (!selected.size) { App.toast('请先选择答案'); return; }
    const user = Array.from(selected).sort().join('');
    const correct = user === (q.answer || '').split('').sort().join('');
    /* 标红标绿 */
    el.querySelectorAll('.option-answer').forEach(b => {
      b.disabled = true;
      const k = b.dataset.key;
      if ((q.answer || '').includes(k)) b.classList.add('right');
      if (selected.has(k) && !(q.answer || '').includes(k)) b.classList.add('wrong');
    });
    await this.finishJudge(correct);
  },

  async judge(correct) {
    await this.finishJudge(correct);
  },

  async finishJudge(correct) {
    const run = this.run;
    const q = run.questions[run.idx];
    run.results[run.idx] = { id: q.id, correct, masteredBefore: q.mastered };
    await Store.recordPractice(q.id, correct);
    this.render(document.getElementById('main'));
  },

  /* ---------- 结果页 ---------- */
  renderResult(el) {
    const run = this.run;
    const total = run.questions.length;
    const right = run.results.filter(r => r.correct).length;
    const wrong = total - right;
    const rate = total ? Math.round(right / total * 100) : 0;

    const wrongList = run.questions.filter((q, i) => run.results[i] && !run.results[i].correct);
    /* 建议标记掌握：本轮做对 且 累计已对≥2 且 未掌握 */
    const suggestIds = run.results.filter(r => r.correct && !r.masteredBefore).map(r => r.id);

    el.innerHTML = `
      <div class="card" style="text-align:center;padding:26px 16px;">
        <div style="font-size:3rem;">${rate >= 80 ? '🎉' : rate >= 60 ? '💪' : '📚'}</div>
        <div style="font-size:1.9rem;font-weight:700;color:${rate >= 60 ? 'var(--green)' : 'var(--orange)'};margin:6px 0;">${right} / ${total}</div>
        <div style="color:var(--text-sub);">正确率 ${rate}%</div>
        <div style="margin-top:14px;display:flex;gap:10px;">
          <div class="stat-box green"><div class="num">${right}</div><div class="lbl">做对</div></div>
          <div class="stat-box orange"><div class="num">${wrong}</div><div class="lbl">做错</div></div>
        </div>
      </div>

      ${suggestIds.length ? `
        <div class="card">
          <div class="card-title">✨ 本轮做对 ${suggestIds.length} 题</div>
          <p style="font-size:.85rem;color:var(--text-sub);margin-bottom:10px;">做对的错题建议标记为"已掌握"，错题本会自动统计掌握进度。</p>
          <button class="btn btn-green btn-block" id="btnMasterAll">将本轮做对的题标记为已掌握</button>
        </div>` : ''}

      ${wrongList.length ? `
        <div class="card">
          <div class="card-title">❌ 本轮做错的题（${wrongList.length}）</div>
          ${wrongList.map((q, i) => `
            <div style="padding:9px 0;border-bottom:1px solid #f0f1f5;display:flex;gap:8px;align-items:flex-start;cursor:pointer;" data-goto="${App.esc(q.id)}">
              <span style="flex-shrink:0;font-weight:700;color:var(--red);">${i + 1}.</span>
              <span style="font-size:.88rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${App.esc(q.stem)}</span>
            </div>`).join('')}
          <div class="form-hint" style="margin-top:6px;">点击题目可查看详情</div>
        </div>` : ''}

      <div style="display:flex;gap:10px;margin-top:4px;">
        <button class="btn btn-outline" id="btnAgain" style="flex:1;">🔄 再来一轮</button>
        <button class="btn btn-primary" id="btnDone" style="flex:1;">完成</button>
      </div>
    `;

    el.querySelectorAll('[data-goto]').forEach(d => d.onclick = () => App.go('detail', { id: d.dataset.goto }));
    const btnMasterAll = el.querySelector('#btnMasterAll');
    if (btnMasterAll) btnMasterAll.onclick = async () => {
      for (const id of suggestIds) await Store.setMastered(id, true);
      App.toast(`已将 ${suggestIds.length} 题标记为掌握 ✓`);
      btnMasterAll.disabled = true;
      btnMasterAll.textContent = '已标记 ✓';
    };
    el.querySelector('#btnAgain').onclick = async () => {
      this.run = null;
      await this.startRound();
    };
    el.querySelector('#btnDone').onclick = () => {
      this.run = null;
      App.go('home');
    };
  }
};

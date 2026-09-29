/* ===== 错题详情 ===== */
Views.detail = {
  q: null,

  async init(id) {
    const q = await Store.getQuestion(id);
    if (!q) throw new Error('错题不存在');
    this.q = q;
  },

  render(el) {
    const q = this.q;
    const typeName = TYPE_NAMES[q.type] || q.type;

    const optionsHtml = q.type !== 'subjective' && q.options && q.options.length
      ? `<div style="margin-top:8px;padding:10px 12px;background:#f7f9fc;border-radius:10px;border:1px solid var(--border);">
          ${q.options.map(o => {
            const isAns = q.type === 'single' ? q.answer === o.key : (q.answer || '').includes(o.key);
            const isWrong = q.type === 'single' ? q.wrongAnswer === o.key : (q.wrongAnswer || '').includes(o.key);
            let cls = '';
            if (isAns) cls = 'color:var(--green);font-weight:700;';
            if (isWrong) cls = 'color:var(--red);text-decoration:line-through;';
            return `<div class="option-line" style="font-size:.92rem;padding:3px 0;${cls}"><b>${App.esc(o.key)}.</b> ${App.esc(o.text)}</div>`;
          }).join('')}
        </div>`
      : '';

    const tagsHtml = (q.tags || []).map(t => `<span class="badge badge-subject">${App.esc(t)}</span>`).join(' ');

    el.innerHTML = `
      <div class="card">
        <div class="q-card-head" style="margin-bottom:10px;">
          <span class="badge badge-${q.type === 'single' ? 'single' : 'subjective'}">${typeName}</span>
          <span class="badge badge-subject">${App.esc(Views.home.subjectName(q.subject))}</span>
          ${q.mastered ? '<span class="badge badge-mastered">✓ 已掌握</span>' : ''}
          <span style="flex:1"></span>
          <span style="font-size:.76rem;color:var(--text-light)">${fmtDate(q.createdAt)}</span>
        </div>
        <div style="font-size:.98rem;white-space:pre-wrap;word-break:break-word;line-height:1.7;">${App.esc(q.stem)}${(!q.stem && q.images && q.images.length) ? '<span style="color:var(--text-light);">（题目见图片）</span>' : ''}</div>
        ${q.images && q.images.length ? `<div class="q-imgs">${q.images.map(id => `<img data-imgid="${App.esc(id)}" alt="题目图片">`).join('')}</div>` : ''}
        ${optionsHtml}

        <div class="answer-box">
          <div class="answer-line"><b>正确答案：</b>${App.esc(q.answer || '（未填写）')}</div>
          ${q.wrongAnswer ? `<div class="answer-line answer-wrong"><b>我的错答：</b>${App.esc(q.wrongAnswer)}</div>` : ''}
          ${q.reason ? `<div class="answer-line answer-reason"><b>错因：</b>${App.esc(q.reason)}</div>` : ''}
          ${q.analysis ? `<div class="answer-line answer-analysis"><b>解析：</b><span style="white-space:pre-wrap;">${App.esc(q.analysis)}</span></div>` : ''}
        </div>

        ${tagsHtml ? `<div style="margin-top:12px;"><span class="form-label" style="margin-bottom:6px;">知识点</span><div class="detail-tags">${tagsHtml}</div></div>` : ''}
        ${q.source ? `<div style="margin-top:12px;font-size:.85rem;color:var(--text-sub);"><b>来源：</b>${App.esc(q.source)}</div>` : ''}

        <div style="margin-top:12px;display:flex;gap:8px;font-size:.78rem;color:var(--text-light);">
          <span class="correct">练习对 ${q.correctCount || 0} 次</span>
          <span class="wrong">练习错 ${q.wrongCount || 0} 次</span>
        </div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="btnRedo" style="flex:1;">🔁 再做一遍</button>
        <button class="btn ${q.mastered ? 'btn-gray' : 'btn-green'}" id="btnMaster" style="flex:1;">${q.mastered ? '取消掌握' : '✓ 标记掌握'}</button>
      </div>
      <div style="display:flex;gap:10px;margin-top:10px;">
        <button class="btn btn-outline" id="btnEdit" style="flex:1;">✏️ 编辑</button>
        <button class="btn btn-red" id="btnDelete" style="flex:1;">🗑 删除</button>
      </div>
    `;

    el.querySelector('#btnRedo').onclick = () => {
      Views.practice.startSingle(q.id);
    };
    el.querySelector('#btnMaster').onclick = async () => {
      const after = await Store.setMastered(q.id, !q.mastered);
      this.q = after;
      this.render(el);
      App.toast(after.mastered ? '已标记为掌握 ✓' : '已取消掌握标记');
    };
    el.querySelector('#btnEdit').onclick = () => App.go('add', { editId: q.id });
    App.bindImages(el);
    el.querySelector('#btnDelete').onclick = async () => {
      const ok = await App.confirm('删除错题', '确定要删除这道错题吗？删除后无法恢复（除非之前导出过备份）。');
      if (!ok) return;
      await Store.deleteQuestion(q.id);
      App.toast('已删除');
      App.go('home');
    };
  }
};

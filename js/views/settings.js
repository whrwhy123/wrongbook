/* ===== 设置：科目管理 / 数据备份 / 关于 ===== */
Views.settings = {
  tab: 'backup', /* backup | subjects | tags | about */

  render(el) {
    const active = this.tab;
    el.innerHTML = `
      <div class="chips" style="margin-bottom:12px;">
        <button class="chip ${active === 'backup' ? 'active' : ''}" data-tab="backup">数据备份</button>
        <button class="chip ${active === 'subjects' ? 'active' : ''}" data-tab="subjects">科目管理</button>
        <button class="chip ${active === 'tags' ? 'active' : ''}" data-tab="tags">知识点标签</button>
        <button class="chip ${active === 'about' ? 'active' : ''}" data-tab="about">使用说明</button>
      </div>
      <div id="settingContent"></div>
    `;
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
      this.tab = b.dataset.tab;
      this.render(el);
    });
    const content = el.querySelector('#settingContent');
    if (active === 'backup') this.renderBackup(content);
    else if (active === 'subjects') this.renderSubjects(content);
    else if (active === 'tags') this.renderTags(content);
    else this.renderAbout(content);
  },

  /* ---------- 备份 ---------- */
  async renderBackup(el) {
    const lastBackupAt = await Store.getMeta('lastBackupAt');
    const qCount = (await DB.getAll('questions')).length;
    const mirror = Mirror.read();

    el.innerHTML = `
      <div class="card">
        <div class="card-title">🛡 数据安全</div>
        <p style="font-size:.88rem;color:var(--text-sub);line-height:1.7;">
          你的 ${qCount} 道错题保存在本机（手机/电脑浏览器）数据库中，即使断网也能正常使用。
          建议每 3~7 天导出一次备份，把备份文件存到网盘或微信收藏，换手机、清缓存都不怕丢。
        </p>
      </div>

      <div class="card">
        <button class="btn btn-primary btn-block btn-lg" id="btnExportBackup">⬇ 导出备份文件（JSON）</button>
        <div class="form-hint" style="text-align:center;margin:8px 0 14px;">
          ${lastBackupAt ? `上次备份时间：${fmtDate(lastBackupAt)}` : '还没有导出过备份'}
        </div>
        <button class="btn btn-outline btn-block" id="btnImportBackup">⬆ 导入备份 / 恢复数据</button>
        <input type="file" id="backupFile" accept=".json,application/json" style="display:none;">
      </div>

      <div class="card">
        <div class="card-title">💾 本地自动镜像</div>
        <p style="font-size:.85rem;color:var(--text-sub);margin-bottom:10px;">
          每次添加、修改错题时，数据会自动同步一份镜像保存在本机。
          若数据库异常导致错题不见了，可从镜像一键恢复。
        </p>
        <p style="font-size:.78rem;color:var(--text-light);margin-bottom:10px;">
          ${mirror ? `镜像共 ${mirror.questions.length} 题，最近同步于 ${fmtDate(new Date(mirror.savedAt))}` : '暂无镜像'}
        </p>
        <button class="btn btn-gray btn-block" id="btnRestoreMirror">从本地镜像恢复数据</button>
      </div>
    `;

    el.querySelector('#btnExportBackup').onclick = async () => {
      const n = await exportBackup();
      App.toast(`已导出 ${n} 道错题的备份文件 ✓`);
    };
    el.querySelector('#btnImportBackup').onclick = () => {
      el.querySelector('#backupFile').click();
    };
    el.querySelector('#backupFile').onchange = async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const ok = await App.confirm('导入备份', `将把备份文件合并到当前错题本（重复题目取最新版本）。确定继续？`);
      if (!ok) return;
      try {
        const r = await importBackup(file);
        App.toast(`导入成功：新增 ${r.added} 题，更新 ${r.updated} 题`);
        this.render(document.getElementById('main'));
      } catch (err) {
        App.toast(err.message || '导入失败');
      }
    };
    el.querySelector('#btnRestoreMirror').onclick = async () => {
      const ok = await App.confirm('恢复镜像', '将用本地镜像覆盖当前全部数据，确定恢复吗？');
      if (!ok) return;
      try {
        const n = await Mirror.restore();
        App.toast(`已从镜像恢复 ${n} 道错题 ✓`);
        this.render(document.getElementById('main'));
      } catch (err) {
        App.toast(err.message || '恢复失败');
      }
    };
  },

  /* ---------- 科目管理 ---------- */
  async renderSubjects(el) {
    const subjects = await Store.getSubjects();
    const stats = await Store.stats();
    const list = subjects.map(s => {
      const count = stats.bySubject[s.id] || 0;
      return `
        <div class="setting-item" style="margin-bottom:8px;">
          <span class="si-icon">📁</span>
          <div class="si-text">${App.esc(s.name)}<div class="si-sub">${count} 道错题</div></div>
          <button class="btn btn-light btn-sm" data-rename="${App.esc(s.id)}">重命名</button>
          <button class="btn btn-red btn-sm" data-del="${App.esc(s.id)}">删除</button>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="card">
        <div class="card-title">＋ 添加科目</div>
        <div style="display:flex;gap:8px;">
          <input class="input" id="newSubject" placeholder="如：公共基础知识、职测…">
          <button class="btn btn-primary" id="btnAddSubject" style="flex-shrink:0;">添加</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">现有科目</div>
        ${list || '<p style="color:var(--text-light);font-size:.88rem;">暂无科目</p>'}
        <div class="form-hint" style="margin-top:8px;">删除科目后，其下错题将变为"未分类"，题目本身不会丢失。</div>
      </div>
    `;

    const addSubject = async () => {
      const input = el.querySelector('#newSubject');
      try {
        await Store.addSubject(input.value);
        input.value = '';
        App.toast('科目已添加 ✓');
        this.render(document.getElementById('main'));
      } catch (e) { App.toast(e.message); }
    };
    el.querySelector('#btnAddSubject').onclick = addSubject;
    el.querySelector('#newSubject').addEventListener('keydown', e => {
      if (e.key === 'Enter') addSubject();
    });

    el.querySelectorAll('[data-rename]').forEach(b => b.onclick = async () => {
      const id = b.dataset.rename;
      const s = subjects.find(x => x.id === id);
      const name = await App.prompt('重命名科目', '输入新的科目名称', s.name);
      if (!name || name === s.name) return;
      try {
        await Store.renameSubject(id, name);
        App.toast('已重命名 ✓');
        this.render(document.getElementById('main'));
      } catch (e) { App.toast(e.message); }
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const id = b.dataset.del;
      const s = subjects.find(x => x.id === id);
      const count = stats.bySubject[id] || 0;
      const ok = await App.confirm('删除科目',
        `确定删除"${s.name}"吗？${count ? `其下 ${count} 道错题将变为"未分类"。` : ''}`);
      if (!ok) return;
      await Store.deleteSubject(id);
      App.toast('科目已删除');
      this.render(document.getElementById('main'));
    });
  },

  /* ---------- 标签管理 ---------- */
  async renderTags(el) {
    const tags = await Store.getTags();
    const questions = await DB.getAll('questions');
    const countOf = name => questions.filter(q => (q.tags || []).includes(name)).length;

    el.innerHTML = `
      <div class="card">
        <div class="card-title">＋ 添加知识点标签</div>
        <div style="display:flex;gap:8px;">
          <input class="input" id="newTag" placeholder="如：课程性质、教学评价…">
          <button class="btn btn-primary" id="btnAddTag" style="flex-shrink:0;">添加</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">现有标签（${tags.length}）</div>
        ${tags.map(t => `
          <div class="setting-item" style="margin-bottom:8px;">
            <span class="si-icon">🏷</span>
            <div class="si-text">${App.esc(t.name)}<div class="si-sub">${countOf(t.name)} 道错题使用</div></div>
            <button class="btn btn-red btn-sm" data-del="${App.esc(t.id)}">删除</button>
          </div>`).join('') || '<p style="color:var(--text-light);font-size:.88rem;">暂无标签，添加错题时可以创建</p>'}
      </div>
    `;

    const addTag = async () => {
      const input = el.querySelector('#newTag');
      try {
        await Store.addTag(input.value);
        input.value = '';
        App.toast('标签已添加 ✓');
        this.render(document.getElementById('main'));
      } catch (e) { App.toast(e.message); }
    };
    el.querySelector('#btnAddTag').onclick = addTag;
    el.querySelector('#newTag').addEventListener('keydown', e => {
      if (e.key === 'Enter') addTag();
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const id = b.dataset.del;
      const t = tags.find(x => x.id === id);
      const ok = await App.confirm('删除标签', `确定删除标签"${t.name}"吗？所有错题上的该标签都会被移除。`);
      if (!ok) return;
      await Store.deleteTag(id);
      App.toast('标签已删除');
      this.render(document.getElementById('main'));
    });
  },

  /* ---------- 使用说明 ---------- */
  renderAbout(el) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title">📖 错题本使用指南</div>
        <div style="font-size:.9rem;color:var(--text-sub);line-height:1.9;">
          <p><b>1. 记错题</b>：在「错题」页点右下角 ＋，录入题干、正确答案、我的错答、错因和解析，并打上知识点标签。</p>
          <p><b>2. 组试卷</b>：在「试卷」页勾选错题生成试卷，手机上先做一遍，再逐题点开答案核对错因；也可导出 Word 打印出来做。</p>
          <p><b>3. 勤练习</b>：在「练习」页随机抽题刷题，做错的题会自动累计次数；做对的题建议标记"已掌握"。</p>
          <p><b>4. 保数据</b>：错题保存在本机数据库，并自动生成本地镜像；建议每周在「设置 → 数据备份」导出一次备份文件存到网盘。换手机 / 换浏览器时，用「导入备份文件」一键恢复。</p>
        </div>
      </div>
      <div class="card">
        <div class="card-title">📱 手机使用（不需要电脑开机）</div>
        <div style="font-size:.9rem;color:var(--text-sub);line-height:1.9;">
          <p>1. 错题本已部署在云端：<b>https://whrwhy123.github.io/wrongbook/</b>，手机联网即可使用，<b>与电脑是否开机无关</b>。</p>
          <p>2. 手机浏览器打开上面网址（iPhone 用 Safari，安卓推荐 Chrome），菜单中选「<b>添加到主屏幕</b>」，即可像 App 一样使用。</p>
          <p>3. 添加后首次联网打开过，之后<b>断网也能离线打开</b>使用。</p>
          <p style="margin-top:6px;font-size:.82rem;color:var(--text-light);">可选：电脑开机时，双击电脑 wrongbook 文件夹里的 start.bat 可启动局域网服务，供同一 WiFi 下的设备访问；与云端版相互独立、数据不互通（可用备份文件互迁）。</p>
        </div>
      </div>
      <div class="card">
        <div class="card-title">ℹ️ 关于</div>
        <div style="font-size:.85rem;color:var(--text-light);">考编 · 高中政治错题本 v1.0<br>数据全部保存在你自己的设备上，安全无忧。</div>
      </div>
    `;
  }
};

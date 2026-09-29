/* ===== 应用主入口：路由、导航、全局工具 ===== */
const App = {
  state: { view: 'home', params: {} },
  title: '错题本',
  homeViewNames: ['home', 'paper', 'practice', 'settings'],

  /* HTML 转义 */
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  async boot() {
    try {
      await DB.open();
      await Store.init();
    } catch (e) {
      const main = document.getElementById('main');
      main.innerHTML = `<div class="empty"><span class="empty-icon">⚠️</span>
        <p>数据库初始化失败：${App.esc(e.message || e)}</p>
        <p style="margin-top:8px;font-size:.8rem;">请尝试更换浏览器（推荐 Chrome / Edge / 手机自带浏览器）。</p></div>`;
      return;
    }

    /* 注册 Service Worker（PWA 离线缓存，仅 http/https 下生效） */
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    this.bindGlobal();
    this.checkBackupReminder();
    this.go('home');
  },

  bindGlobal() {
    document.querySelectorAll('#tabbar .tab').forEach(tab => {
      tab.onclick = () => this.go(tab.dataset.view);
    });
    document.getElementById('backBtn').onclick = () => this.goBack();
  },

  /* 备份提醒：距上次备份超过 7 天 */
  async checkBackupReminder() {
    const last = await Store.getMeta('lastBackupAt');
    if (!last) {
      const qs = await DB.getAll('questions');
      if (qs.length >= 5) {
        this.toast('💡 已有不少错题啦，记得去「设置」导出备份哦', 4000);
      }
      return;
    }
    const days = Math.floor((Date.now() - last) / 86400000);
    if (days >= 7) {
      const go = await this.confirm('备份提醒', `距上次备份已过 ${days} 天，建议立即导出一份备份文件，防止数据丢失。现在去备份？`);
      if (go) this.go('settings');
    }
  },

  go(view, params = {}) {
    this.state = { view, params };
    this.render();
    window.scrollTo(0, 0);
  },

  goBack() {
    const { view } = this.state;
    if (view === 'add' || view === 'detail') this.go('home');
    else this.go('home');
  },

  setTitle(t) {
    this.title = t;
    document.getElementById('pageTitle').textContent = t;
  },

  async render() {
    const { view, params } = this.state;
    const main = document.getElementById('main');
    const isHomeView = this.homeViewNames.includes(view);

    /* 顶栏 */
    const backBtn = document.getElementById('backBtn');
    backBtn.hidden = isHomeView;
    const titles = {
      home: '错题本', paper: '试卷', practice: '练习',
      settings: '设置', add: params.editId ? '编辑错题' : '添加错题', detail: '错题详情'
    };
    this.setTitle(titles[view] || this.title);

    /* 底栏 */
    document.getElementById('tabbar').style.display = isHomeView ? 'flex' : 'none';
    document.querySelectorAll('#tabbar .tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });

    /* 悬浮添加按钮 */
    const fab = document.getElementById('fab') || this.makeFab();
    fab.style.display = view === 'home' ? 'flex' : 'none';

    /* 视图渲染 */
    try {
      if (view === 'home') {
        await Views.home.load();
        Views.home.render(main);
      } else if (view === 'add') {
        await Views.add.init(params.editId || null);
        Views.add.render(main);
      } else if (view === 'detail') {
        await Views.detail.init(params.id);
        Views.detail.render(main);
      } else if (view === 'paper') {
        await Views.paper.load();
        Views.paper.render(main);
      } else if (view === 'practice') {
        Views.practice.render(main);
      } else if (view === 'settings') {
        Views.settings.render(main);
      }
    } catch (e) {
      main.innerHTML = `<div class="empty"><span class="empty-icon">⚠️</span>
        <p>${App.esc(e.message || '页面加载失败')}</p>
        <button class="btn btn-primary" style="margin-top:14px;" onclick="App.go('home')">返回首页</button></div>`;
    }
  },

  makeFab() {
    const fab = document.createElement('button');
    fab.id = 'fab';
    fab.className = 'fab';
    fab.setAttribute('aria-label', '添加错题');
    fab.textContent = '＋';
    fab.onclick = () => this.go('add');
    document.getElementById('app').appendChild(fab);
    return fab;
  },

  /* ---------- Toast ---------- */
  _toastTimer: null,
  toast(msg, duration = 2200) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), duration);
  },

  /* ---------- 确认对话框 ---------- */
  confirm(title, msg, okText = '确定', cancelText = '取消') {
    return new Promise(resolve => {
      const wrap = document.getElementById('modalWrap');
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalBody').textContent = msg;
      const actions = document.getElementById('modalActions');
      actions.innerHTML = `
        <button class="btn btn-gray" id="mCancel">${App.esc(cancelText)}</button>
        <button class="btn btn-primary" id="mOk">${App.esc(okText)}</button>`;
      wrap.hidden = false;
      const close = (val) => {
        wrap.hidden = true;
        resolve(val);
      };
      actions.querySelector('#mOk').onclick = () => close(true);
      actions.querySelector('#mCancel').onclick = () => close(false);
      wrap.onclick = (e) => { if (e.target === wrap) close(false); };
    });
  },

  /* ---------- 输入对话框 ---------- */
  prompt(title, msg, defaultValue = '') {
    return new Promise(resolve => {
      const wrap = document.getElementById('modalWrap');
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalBody').innerHTML =
        `<div>${App.esc(msg)}</div><input class="input" id="mInput" value="${App.esc(defaultValue)}">`;
      const actions = document.getElementById('modalActions');
      actions.innerHTML = `
        <button class="btn btn-gray" id="mCancel">取消</button>
        <button class="btn btn-primary" id="mOk">确定</button>`;
      wrap.hidden = false;
      const input = document.getElementById('mInput');
      input.focus();
      input.select();
      const close = (val) => {
        wrap.hidden = true;
        resolve(val);
      };
      actions.querySelector('#mOk').onclick = () => close(input.value.trim());
      actions.querySelector('#mCancel').onclick = () => close(null);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') close(input.value.trim());
      });
      wrap.onclick = (e) => { if (e.target === wrap) close(null); };
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.boot());

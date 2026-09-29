/* ===== 拍照识字（OCR）：Tesseract.js 懒加载，国内 CDN ===== */
const OCR = {
  worker: null,
  loading: null,
  busy: false,

  SCRIPTS: [
    'https://registry.npmmirror.com/tesseract.js/5.1.1/files/dist/tesseract.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js'
  ],

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => { s.remove(); reject(new Error('load fail')); };
      document.head.appendChild(s);
    });
  },

  async ensureEngine() {
    if (window.Tesseract) return;
    let lastErr = null;
    for (const url of this.SCRIPTS) {
      try {
        await this.loadScript(url);
        if (window.Tesseract) return;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('识别引擎下载失败');
  },

  /* 创建/复用 OCR worker（中文包约 1.7MB，浏览器缓存后二次秒开） */
  ensureWorker(onMsg) {
    if (this.worker) return Promise.resolve(this.worker);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      onMsg && onMsg('正在下载识别引擎（首次约 6MB）…');
      await this.ensureEngine();
      onMsg && onMsg('正在加载中文识别包…');
      this.worker = await Tesseract.createWorker('chi_sim', 1, {
        workerPath: 'https://registry.npmmirror.com/tesseract.js/5.1.1/files/dist/worker.min.js',
        corePath: 'https://registry.npmmirror.com/tesseract.js-core/5.1.1/files',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast',
        errorHandler: () => {}
      });
      return this.worker;
    })();
    return this.loading.catch(e => { this.loading = null; throw e; });
  },

  /* 清洗识别结果：去除快速模型的标点噪声，保留换行 */
  cleanText(raw) {
    let t = String(raw || '').replace(/\r/g, '');
    /* 去掉汉字之间的空格 */
    for (let i = 0; i < 3; i++) t = t.replace(/([一-龥])\s+([一-龥])/g, '$1$2');
    /* 重复标点合并 */
    t = t.replace(/[，,、]{2,}/g, '，');
    /* 题号后的多余顿逗号：1.， → 1. */
    t = t.replace(/(\d\s*\.)\s*[，,、]+/g, '$1 ');
    /* 行首选项字母规范化：A，、xxx → A. xxx */
    t = t.replace(/^\s*([A-H])\s*[，,、．.]*/gm, '$1. ');
    /* 行尾多余顿逗号/叹号 */
    t = t.replace(/[，,、]+\s*$/gm, '');
    /* 去空行 */
    t = t.split('\n').map(l => l.trim()).filter(l => l).join('\n');
    return t;
  },

  /* 识别一张图片，成功后回调 onDone(文本) */
  async recognize(file, onDone) {
    if (this.busy) { App.toast('正在识别中，请稍候'); return; }
    this.busy = true;
    const btn = document.getElementById('btnOcr');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 识别中…'; }
    try {
      const worker = await this.ensureWorker(m => App.toast(m, 2600));
      App.toast('正在识别文字，请稍候…', 2600);
      const { data } = await worker.recognize(file);
      const text = this.cleanText(data && data.text);
      if (!text) {
        App.toast('未识别到文字：请光线充足、拍正拍清后重试', 3200);
      } else {
        onDone(text);
        App.toast('识别完成，已填入题干，可手动修改 ✓', 2600);
      }
    } catch (e) {
      App.toast('识别失败：' + (e && e.message ? e.message : '网络异常') + '。也可用手机相册「提取文字」复制后粘贴', 4000);
    } finally {
      this.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '📷 拍照识字'; }
    }
  }
};

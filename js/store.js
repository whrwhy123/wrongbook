/* ===== 业务数据操作层 ===== */
const Store = {
  uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  /* 预置科目（考编·高中政治；升级时自动补全缺失科目） */
  PRESET_SUBJECTS: [
    '必修1 中国特色社会主义',
    '必修2 经济与社会',
    '必修3 政治与法治',
    '必修4 哲学与文化',
    '选必1 当代国际政治与经济',
    '选必2 法律与生活',
    '选必3 逻辑与思维',
    '教育综合知识',
    '学科教育教学知识',
  ],

  /* 初始化：补全预置科目 */
  async init() {
    const subs = await DB.getAll('subjects');
    const existing = new Set(subs.map(s => s.name));
    let t = Date.now();
    for (const name of this.PRESET_SUBJECTS) {
      if (!existing.has(name)) {
        await DB.add('subjects', { id: this.uid('s'), name, createdAt: t++ });
      }
    }
  },

  /* ---------- 科目 ---------- */
  async getSubjects() {
    const list = await DB.getAll('subjects');
    return list.sort((a, b) => a.createdAt - b.createdAt);
  },

  async addSubject(name) {
    name = (name || '').trim();
    if (!name) throw new Error('科目名称不能为空');
    const subs = await this.getSubjects();
    if (subs.some(s => s.name === name)) throw new Error('该科目已存在');
    const s = { id: this.uid('s'), name, createdAt: Date.now() };
    await DB.add('subjects', s);
    return s;
  },

  async renameSubject(id, name) {
    name = (name || '').trim();
    if (!name) throw new Error('科目名称不能为空');
    const subs = await this.getSubjects();
    if (subs.some(s => s.name === name && s.id !== id)) throw new Error('该科目已存在');
    const s = await DB.get('subjects', id);
    if (!s) throw new Error('科目不存在');
    s.name = name;
    await DB.put('subjects', s);
  },

  /* 删除科目：其下错题变为"未分类" */
  async deleteSubject(id) {
    const qs = await DB.getAll('questions');
    const touched = qs.filter(q => q.subject === id);
    if (touched.length) {
      for (const q of touched) {
        q.subject = '';
        q.updatedAt = Date.now();
        await DB.put('questions', q);
      }
    }
    await DB.del('subjects', id);
    Mirror.save();
    return touched.length;
  },

  /* ---------- 知识点标签 ---------- */
  async getTags() {
    const list = await DB.getAll('tags');
    return list.sort((a, b) => a.createdAt - b.createdAt);
  },

  async addTag(name) {
    name = (name || '').trim();
    if (!name) throw new Error('标签不能为空');
    const tags = await this.getTags();
    if (tags.some(t => t.name === name)) throw new Error('该标签已存在');
    const t = { id: this.uid('t'), name, createdAt: Date.now() };
    await DB.add('tags', t);
    return t;
  },

  async deleteTag(id) {
    const tag = await DB.get('tags', id);
    if (tag) {
      const qs = await DB.getAll('questions');
      for (const q of qs) {
        const idx = q.tags.indexOf(tag.name);
        if (idx >= 0) {
          q.tags.splice(idx, 1);
          await DB.put('questions', q);
        }
      }
      await DB.del('tags', id);
      Mirror.save();
    }
  },

  /* ---------- 错题 ---------- */
  async addQuestion(q) {
    q.id = this.uid('q');
    q.createdAt = Date.now();
    q.updatedAt = q.createdAt;
    q.correctCount = q.correctCount || 0;
    q.wrongCount = q.wrongCount || 0;
    q.mastered = !!q.mastered;
    q.masteredAt = q.mastered ? Date.now() : null;
    if (!q.tags) q.tags = [];
    await DB.put('questions', q);
    Mirror.save();
    return q;
  },

  async updateQuestion(q) {
    q.updatedAt = Date.now();
    if (q.mastered && !q.masteredAt) q.masteredAt = Date.now();
    await DB.put('questions', q);
    Mirror.save();
    return q;
  },

  async deleteQuestion(id) {
    const q = await DB.get('questions', id);
    await DB.del('questions', id);
    /* 连同题目贴图一起删除，避免残留占用空间 */
    if (q && q.images && q.images.length) {
      for (const im of q.images) { try { await DB.del('images', im); } catch (e) {} }
    }
    Mirror.save();
  },

  async getQuestion(id) {
    return DB.get('questions', id);
  },

  async listQuestions() {
    const list = await DB.getAll('questions');
    return list.sort((a, b) => b.createdAt - a.createdAt);
  },

  /* 记录一次练习结果 */
  async recordPractice(id, correct) {
    const q = await DB.get('questions', id);
    if (!q) return null;
    if (correct) {
      q.correctCount = (q.correctCount || 0) + 1;
      q.lastResult = true;
    } else {
      q.wrongCount = (q.wrongCount || 0) + 1;
      q.lastResult = false;
      /* 做错了就自动取消"已掌握"标记 */
      if (q.mastered) { q.mastered = false; q.masteredAt = null; }
    }
    q.updatedAt = Date.now();
    await DB.put('questions', q);
    Mirror.save();
    return q;
  },

  /* 标记 / 取消掌握 */
  async setMastered(id, val) {
    const q = await DB.get('questions', id);
    if (!q) return;
    q.mastered = val;
    q.masteredAt = val ? Date.now() : null;
    q.updatedAt = Date.now();
    await DB.put('questions', q);
    Mirror.save();
    return q;
  },

  /* ---------- 题目贴图 ---------- */
  async addImage(dataUrl) {
    const rec = { id: this.uid('img'), dataUrl, createdAt: Date.now() };
    await DB.put('images', rec);
    return rec;
  },

  async getImage(id) {
    return DB.get('images', id);
  },

  async getImages(ids) {
    const out = [];
    for (const id of (ids || [])) {
      const r = await DB.get('images', id);
      if (r) out.push(r);
    }
    return out;
  },

  async deleteImage(id) {
    await DB.del('images', id);
  },

  /* ---------- 统计 ---------- */
  async stats() {
    const qs = await DB.getAll('questions');
    const total = qs.length;
    const mastered = qs.filter(q => q.mastered).length;
    const practiced = qs.filter(q => (q.correctCount || 0) + (q.wrongCount || 0) > 0).length;
    let practiceCorrect = 0, practiceTotal = 0;
    for (const q of qs) {
      practiceCorrect += (q.correctCount || 0);
      practiceTotal += (q.correctCount || 0) + (q.wrongCount || 0);
    }
    const bySubject = {};
    for (const q of qs) {
      const key = q.subject || '未分类';
      bySubject[key] = (bySubject[key] || 0) + 1;
    }
    return {
      total, mastered, practiced,
      rate: practiceTotal ? Math.round(practiceCorrect / practiceTotal * 100) : 0,
      bySubject
    };
  },

  /* ---------- meta ---------- */
  async getMeta(key) {
    const m = await DB.get('meta', key);
    return m ? m.value : null;
  },
  async setMeta(key, value) {
    await DB.put('meta', { key, value });
  }
};

/* ===== 本地镜像备份：每次数据变更自动同步到 localStorage，双保险防丢失 ===== */
const Mirror = {
  KEY: 'wrongbook_mirror',

  async save() {
    try {
      const data = {
        app: 'wrongbook',
        savedAt: new Date().toISOString(),
        subjects: await DB.getAll('subjects'),
        tags: await DB.getAll('tags'),
        /* 镜像只存文字数据（含图片引用 id），图片本体在 IndexedDB，
           避免撑爆 localStorage 5MB 限额；完整备份请用「导出备份文件」 */
        questions: await DB.getAll('questions'),
      };
      localStorage.setItem(this.KEY, JSON.stringify(data));
      Store.setMeta('lastChangeAt', Date.now()).catch(() => {});
    } catch (e) { /* 空间不足等异常不阻断主流程 */ }
  },

  read() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.app === 'wrongbook') return data;
      return null;
    } catch (e) { return null; }
  },

  /* 从镜像恢复（覆盖当前数据） */
  async restore() {
    const data = this.read();
    if (!data) throw new Error('没有找到本地镜像数据');
    const tx = DB._db.transaction(['questions', 'subjects', 'tags'], 'readwrite');
    tx.objectStore('questions').clear();
    tx.objectStore('subjects').clear();
    tx.objectStore('tags').clear();
    await new Promise((res, rej) => {
      tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
    await DB.bulkPut('subjects', data.subjects || []);
    await DB.bulkPut('tags', data.tags || []);
    await DB.bulkPut('questions', data.questions || []);
    await Mirror.save();
    return (data.questions || []).length;
  }
};

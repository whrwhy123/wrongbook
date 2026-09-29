/* ===== 导出模块：JSON 备份 / 试卷导出 Word(.doc) ===== */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
}

function fmtDate(ts) {
  const d = new Date(ts || Date.now());
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtDateShort() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/* ---------- JSON 备份导出 ---------- */
async function exportBackup() {
  const data = {
    app: 'wrongbook',
    version: 1,
    exportedAt: new Date().toISOString(),
    subjects: await DB.getAll('subjects'),
    tags: await DB.getAll('tags'),
    questions: await DB.getAll('questions'),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `错题本备份_${fmtDateShort()}.json`);
  await Store.setMeta('lastBackupAt', Date.now());
  return data.questions.length;
}

/* ---------- JSON 备份导入（合并，冲突按更新时间较新者为准） ---------- */
async function importBackup(file) {
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); }
  catch (e) { throw new Error('文件格式错误，不是有效的备份文件'); }
  if (!data || data.app !== 'wrongbook') throw new Error('这不是错题本的备份文件');
  if (!Array.isArray(data.questions)) throw new Error('备份文件内容不完整');

  const curSubjects = await DB.getAll('subjects');
  const curTags = await DB.getAll('tags');
  const curQuestions = await DB.getAll('questions');

  const subMap = new Map(curSubjects.map(s => [s.id, s]));
  const tagMap = new Map(curTags.map(t => [t.id, t]));
  const qMap = new Map(curQuestions.map(q => [q.id, q]));

  for (const s of (data.subjects || [])) {
    if (!subMap.has(s.id)) { subMap.set(s.id, s); await DB.put('subjects', s); }
  }
  for (const t of (data.tags || [])) {
    if (!tagMap.has(t.id)) { tagMap.set(t.id, t); await DB.put('tags', t); }
  }
  let added = 0, updated = 0;
  for (const q of data.questions) {
    const cur = qMap.get(q.id);
    if (!cur) { await DB.put('questions', q); qMap.set(q.id, q); added++; }
    else if ((q.updatedAt || 0) > (cur.updatedAt || 0)) {
      await DB.put('questions', q); updated++;
    }
  }
  await Store.setMeta('lastBackupAt', Date.now());
  await Mirror.save();
  return { added, updated };
}

/* ---------- 题型名称 ---------- */
const TYPE_NAMES = { single: '单选题', subjective: '主观题' };

/* ---------- 试卷导出 Word (.doc，Word / WPS 均可打开) ---------- */
function buildPaperDoc(questions, title) {
  const singles = questions.filter(q => q.type === 'single');
  const subjectives = questions.filter(q => q.type === 'subjective');

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const nl2br = s => esc(s).replace(/\n/g, '<br/>');

  /* 题目卷 */
  let body = '';
  body += `<div style="text-align:center;font-size:16pt;font-weight:bold;font-family:黑体;">${esc(title)}</div>`;
  body += `<div style="text-align:center;font-size:10.5pt;color:#555;margin-top:6px;font-family:宋体;">生成日期：${esc(fmtDate())}　·　共 ${questions.length} 题（答完可翻到后页核对答案与错因）</div>`;
  body += `<div style="height:1px;background:#333;margin:10px 0 14px;"></div>`;

  let no = 0;
  const renderOption = (q) => {
    let html = '<table border="0" cellspacing="0" cellpadding="0" style="width:100%;margin-top:4px;">';
    const opts = q.options || [];
    const half = Math.ceil(opts.length / 2);
    for (let row = 0; row < half; row++) {
      html += '<tr>';
      for (let col = 0; col < 2; col++) {
        const idx = col === 0 ? row : row + half;
        if (idx < opts.length) {
          html += `<td style="width:50%;font-size:12pt;padding:2px 0;">${esc(opts[idx].key)}. ${esc(opts[idx].text)}</td>`;
        } else {
          html += '<td style="width:50%;"></td>';
        }
      }
      html += '</tr>';
    }
    html += '</table>';
    return html;
  };

  const section = (name, list, isSubjective) => {
    if (!list.length) return '';
    let html = `<div style="font-size:12pt;font-weight:bold;font-family:黑体;margin:12px 0 8px;">${esc(name)}</div>`;
    for (const q of list) {
      no++;
      html += `<div style="margin-bottom:14px;font-size:12pt;line-height:1.7;font-family:宋体;">`;
      html += `<b>${no}.</b> ${nl2br(q.stem)}`;
      if (!isSubjective) {
        html += renderOption(q);
      } else {
        /* 主观题留作答空间 */
        for (let i = 0; i < 5; i++) {
          html += `<div style="border-bottom:1px solid #999;height:30px;"></div>`;
        }
      }
      html += `</div>`;
    }
    return html;
  };

  body += section('一、单项选择题', singles, false);
  body += section('二、主观题（简答 / 材料分析）', subjectives, true);

  /* 答案卷（另起一页） */
  body += `<br clear=all style='mso-special-character:line-break;page-break-before:always'>`;
  body += `<div style="text-align:center;font-size:15pt;font-weight:bold;font-family:黑体;">参考答案与错因分析</div>`;
  body += `<div style="height:1px;background:#333;margin:10px 0 14px;"></div>`;

  let ano = 0;
  for (const q of questions) {
    ano++;
    body += `<div style="margin-bottom:16px;font-size:11pt;line-height:1.7;font-family:宋体;">`;
    body += `<div style="font-weight:bold;">${ano}. ${nl2br(q.stem)}</div>`;
    body += `<div style="margin-top:4px;"><b style="color:#0a7a3d;">【正确答案】</b>${esc(q.answer || '（未填写）')}</div>`;
    if (q.wrongAnswer) {
      body += `<div><b style="color:#c0392b;">【我的错答】</b>${esc(q.wrongAnswer)}</div>`;
    }
    if (q.reason) {
      body += `<div><b style="color:#d35400;">【错因分析】</b>${nl2br(q.reason)}</div>`;
    }
    if (q.analysis) {
      body += `<div><b>【答案解析】</b>${nl2br(q.analysis)}</div>`;
    }
    if (q.tags && q.tags.length) {
      body += `<div><b>【知识点】</b>${esc(q.tags.join('、'))}</div>`;
    }
    body += `</div>`;
  }

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
@page { size: 595.3pt 841.9pt; margin: 56.7pt 48pt; }
body { font-family: 宋体; font-size: 12pt; }
</style></head>
<body>${body}</body></html>`;

  /* \ufeff BOM 确保 Word 正确识别 UTF-8 */
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  return blob;
}

function exportPaperDoc(questions, title) {
  if (!questions.length) throw new Error('没有可导出的题目');
  const blob = buildPaperDoc(questions, title);
  downloadBlob(blob, `${title}_${fmtDateShort()}.doc`);
}

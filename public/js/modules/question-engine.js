/* ===== 问答引擎 ===== */

// ── 进度条 ──

function renderProgress(roleQs) {
  const total = roleQs.length;
  let done = 0;
  const qs = state.answers;
  done = Object.keys(qs).filter(k => qs[k] && qs[k].length >= 5).length;

  let current = state.currentQIdx;

  let dots = '';
  for (let i = 0; i < Math.min(total, 9); i++) {
    if (i < done) dots += '<span class="progress-dot done"></span>';
    else if (i === current) dots += '<span class="progress-dot current"></span>';
    else dots += '<span class="progress-dot"></span>';
  }
  return dots + `<span class="progress-text">${done}/${total} 完成</span>`;
}

// ── 主渲染 ──

function renderCurrentQuestion() {
  const roleQs = ROLE_QUESTIONS[state.role];
  if (!roleQs) return;

  const container = document.getElementById('qaCards');
  const btns = document.getElementById('qaButtons');
  const progressBar = document.getElementById('progressBar');

  progressBar.innerHTML = renderProgress(roleQs);

  const qData = roleQs[state.currentQIdx];
  const existingAnswer = state.answers[qData.field] || '';
  const isFirstQ = state.currentQIdx === 0;
  const needProvince = isFirstQ && currentRoleNeedsProvince();

  container.innerHTML = buildQACard(qData, existingAnswer, state.currentQIdx + 1, roleQs.length, needProvince);
  btns.innerHTML = buildButtons(qData);

  // 恢复已填内容的字符计数
  setTimeout(() => {
    const input = document.querySelector('.qa-input');
    if (input && input.value) updateCharCountEl(input);
  }, 100);
}

// ── Q&A卡片HTML构建 ──

function buildQACard(qData, existingValue, num, total, needProvince) {
  const field = qData.field;
  const provinceHTML = needProvince ? buildProvinceSelector() : '';
  return `
    <div class="qa-card">
      ${provinceHTML}
      <div class="qa-label q">问题 ${num}/${total}</div>
      <div class="qa-question">${escapeHtml(qData.q).replace(/\n/g, '<br>')}</div>
      <div class="qa-hint">💡 ${escapeHtml(qData.hint)}</div>
      <div class="voice-bar">
        <button class="mic-btn" id="mic_${field}" onclick="toggleVoice('${field}', this)" title="点击开始语音输入（或按 Ctrl+M）">
          <span class="mic-icon">🎤</span><span class="mic-status">语音输入</span>
        </button>
        <button class="btn btn-ghost" style="font-size:11px;padding:6px 12px;" onclick="filterTextarea('${field}')" title="过滤口语化表达">
          ✨ 智能过滤
        </button>
        <span class="rec-indicator" id="recInd_${field}">
          <span class="rec-dot"></span>正在聆听...
        </span>
      </div>
      <div class="live-preview" id="preview_${field}"></div>
      <textarea class="qa-input ${existingValue.length >= qData.minChars ? 'filled' : ''}"
        id="answer_${field}" placeholder="可以打字，也可以按上面🎤按钮直接说话..."
        oninput="onAnswerInput('${field}', this)">${escapeHtml(existingValue)}</textarea>
      <div class="char-count" id="count_${field}">
        ${existingValue.length} / 最少${qData.minChars}字${existingValue.length >= qData.minChars ? ' ✓' : ''}
      </div>
    </div>`;
}

function buildButtons(qData) {
  const currentVal = state.answers[qData.field] || '';
  const minChars = qData.minChars || 10;
  const isFirstQ = state.currentQIdx === 0;
  const needProvince = isFirstQ && currentRoleNeedsProvince();
  const provinceOK = !needProvince || !!state.province;
  const canNext = currentVal.length >= minChars && provinceOK;
  const roleQs = ROLE_QUESTIONS[state.role];
  const isLast = state.currentQIdx >= roleQs.length - 1;

  return `
    <button class="btn btn-primary" ${canNext ? '' : 'disabled'} onclick="nextStep()">
      ${isLast ? '🎯 生成定位报告' : '下一题 →'}
    </button>
    <button class="btn btn-ghost" onclick="skipQuestion()">跳过</button>
    ${isLast ? `<button class="btn btn-primary" style="background:var(--gold)" onclick="regenerateReport()">⚡ 立即生成报告</button>` : ''}
  `;
}

// ── 事件处理 ──

function onAnswerInput(field, el) {
  const val = el.value;
  state.answers[field] = val;
  el.classList.toggle('filled', val.length >= 5);
  updateCharCountEl(el);
  updateButtonStates(field, val);
  saveProgress(); // 自动保存进度
}

function updateCharCountEl(el) {
  const field = el.id.replace('answer_', '');
  const countEl = document.getElementById('count_' + field);
  if (countEl) {
    const min = getMinChars(field);
    countEl.textContent = el.value.length + ' / 最少' + min + '字' + (el.value.length >= min ? ' ✓' : '');
  }
}

function updateButtonStates(field, val) {
  const btnsDiv = document.getElementById('qaButtons');
  if (!btnsDiv) return;
  const primaryBtns = btnsDiv.querySelectorAll('.btn-primary');
  if (primaryBtns.length === 0) return;
  const minChars = getMinChars(field);
  const provinceOK = !(state.currentQIdx === 0 && currentRoleNeedsProvince()) || !!state.province;
  const canNext = val.length >= minChars && provinceOK;
  primaryBtns.forEach(b => {
    if (canNext) {
      b.removeAttribute('disabled');
      b.style.opacity = '1';
      b.style.cursor = 'pointer';
    } else {
      b.setAttribute('disabled', 'disabled');
      b.style.opacity = '0.5';
      b.style.cursor = 'not-allowed';
    }
  });
}

function getMinChars(field) {
  if (state.role) {
    const roleQs = ROLE_QUESTIONS[state.role];
    for (const q of roleQs) {
      if (q.field === field) return q.minChars || 10;
    }
  }
  return 8;
}

function saveCurrentAnswer() {
  const inputs = document.querySelectorAll('.qa-input');
  inputs.forEach(el => {
    const field = el.id.replace('answer_', '');
    const val = el.value;
    state.answers[field] = val;
  });
  saveProgress();
}

// ── 导航流程 ──

function nextStep() {
  // 读取当前 textarea 最新值
  const currentTextarea = document.querySelector('#qaCards .qa-input');
  if (currentTextarea) {
    const field = currentTextarea.id.replace('answer_', '');
    const val = currentTextarea.value;
    state.answers[field] = val;
  }

  const roleQs = ROLE_QUESTIONS[state.role];
  if (!roleQs) { showToast('请先选择角色', 'error'); return; }

  // 第一个问题时检查省份是否已选
  if (state.currentQIdx === 0 && currentRoleNeedsProvince() && !state.province) {
    showToast('请先选择所在省份', 'error');
    return;
  }

  const qData = roleQs[state.currentQIdx];
  const ans = state.answers[qData.field] || '';
  if (ans.length < (qData.minChars || 10)) {
    showToast('请至少输入' + (qData.minChars || 10) + '个字再继续（或点击跳过）', 'error');
    return;
  }

  state.currentQIdx++;
  if (state.currentQIdx >= roleQs.length) {
    generateReport();
  } else {
    saveProgress();
    renderCurrentQuestion();
    document.getElementById('qaArea').scrollIntoView({ behavior: 'smooth' });
  }
}

function skipQuestion() {
  saveCurrentAnswer();
  state.currentQIdx++;
  const roleQs = ROLE_QUESTIONS[state.role];
  if (state.currentQIdx >= roleQs.length) {
    generateReport();
  } else {
    renderCurrentQuestion();
  }
}

function regenerateReport() {
  saveCurrentAnswer();
  generateReport();
}

// ── 省份选择器 ──

function currentRoleNeedsProvince() {
  const role = ROLES.find(r => r.id === state.role);
  return role && role.needProvince;
}

function buildProvinceSelector() {
  const selected = state.province || '';
  let opts = '<option value="">-- 请选择所在省份 --</option>';
  CHINA_PROVINCES.forEach(p => {
    opts += `<option value="${p}" ${p === selected ? 'selected' : ''}>${p}</option>`;
  });
  return `
    <div class="province-bar">
      <label class="province-label">📍 所在省份 <span style="color:var(--red)">*必选</span></label>
      <select class="province-select" id="provinceSelect" onchange="onProvinceChange(this.value)">
        ${opts}
      </select>
    </div>`;
}

function onProvinceChange(val) {
  state.province = val;
  saveProgress();
  // 实时更新按钮状态
  if (state.currentQIdx === 0) {
    const roleQs = ROLE_QUESTIONS[state.role];
    if (roleQs) {
      const qData = roleQs[0];
      updateButtonStates(qData.field, state.answers[qData.field] || '');
    }
  }
}

// ── 智能过滤按钮 ──

function filterTextarea(field) {
  const textarea = document.getElementById('answer_' + field);
  if (!textarea) return;
  const raw = textarea.value;
  const filtered = filterSpeech(raw);
  if (filtered !== raw) {
    textarea.value = filtered;
    onAnswerInput(field, textarea);
  }
}

/* ===== 问答引擎 ===== */

// ── 进度条 ──

function renderProgress(roleQs) {
  const total = roleQs.length * 2 + CROSS_QUESTIONS.length; // 主问题 + 追问 + 交叉
  let done = 0;
  const qs = state.answers, fs = state.followups, cs = state.crossAnswers;
  done = Object.keys(qs).filter(k => qs[k] && qs[k].length >= 5).length +
         Object.keys(fs).filter(k => fs[k] && fs[k].length >= 5).length +
         Object.keys(cs).filter(k => cs[k] && cs[k].length >= 5).length;

  let current = 0;
  if (state.currentStep === 2) {
    current = roleQs.length * 2 + state.crossIdx;
  } else if (state.currentStep === 1) {
    current = roleQs.length + state.currentQIdx;
  } else {
    current = state.currentQIdx;
  }

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

  let html = '';
  if (state.currentStep === 0) {
    const qData = roleQs[state.currentQIdx];
    const existingAnswer = state.answers[qData.field] || '';
    html += buildQACard(qData, existingAnswer, 'q', state.currentQIdx + 1, roleQs.length);
    btns.innerHTML = buildButtons(qData, 'main');
  } else if (state.currentStep === 1) {
    const qData = roleQs[state.currentQIdx];
    const origAnswer = state.answers[qData.field] || '';
    const brief = truncate(origAnswer, 25);
    const followQ = qData.followup.replace('{brief}', brief);
    const followField = qData.field + '_follow';
    const existingFollow = state.followups[followField] || '';
    html += buildFollowCard(followQ, qData.hint, existingFollow);
    btns.innerHTML = buildButtons({ field: followField }, 'follow');
  } else if (state.currentStep === 2) {
    const cq = CROSS_QUESTIONS[state.crossIdx];
    const existing = state.crossAnswers[cq.field] || '';
    html += buildQACard(cq, existing, 'q', state.crossIdx + 1, CROSS_QUESTIONS.length);
    btns.innerHTML = buildButtons(cq, 'cross');
  }

  container.innerHTML = html;

  // 恢复已填内容的字符计数
  setTimeout(() => {
    const input = document.querySelector('.qa-input');
    if (input && input.value) updateCharCountEl(input);
  }, 100);
}

// ── Q&A卡片HTML构建 ──

function buildQACard(qData, existingValue, labelType, num, total) {
  const field = qData.field;
  return `
    <div class="qa-card">
      <div class="qa-label ${labelType}">${labelType === 'q' ? '问题' : '追问'} ${num}/${total}</div>
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

function buildFollowCard(question, hint, existingValue) {
  const qData = ROLE_QUESTIONS[state.role][state.currentQIdx];
  const field = qData.field + '_follow';
  return `
    <div class="qa-card followup">
      <div class="qa-label f">🔍 深度追问</div>
      <div class="qa-question">${escapeHtml(question).replace(/\n/g, '<br>')}</div>
      <div class="qa-hint">💡 ${escapeHtml(hint)}</div>
      <div class="voice-bar">
        <button class="mic-btn" id="mic_${field}" onclick="toggleVoice('${field}', this)" title="点击开始语音输入">
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
      <textarea class="qa-input ${existingValue.length >= 8 ? 'filled' : ''}"
        id="answer_${field}" placeholder="可以打字，也可以按上面🎤按钮直接说话..."
        oninput="onAnswerInput('${field}', this)">${escapeHtml(existingValue)}</textarea>
      <div class="char-count" id="count_${field}">
        ${existingValue.length} / 最少8字${existingValue.length >= 8 ? ' ✓' : ''}
      </div>
    </div>`;
}

function buildButtons(qData, type) {
  const roleQs = ROLE_QUESTIONS[state.role];
  let currentVal = '';
  if (type === 'main') {
    currentVal = state.answers[qData.field] || '';
  } else if (type === 'follow') {
    currentVal = state.followups[qData.field] || '';
  } else if (type === 'cross') {
    currentVal = state.crossAnswers[qData.field] || '';
  }
  const minChars = qData.minChars || 8;
  const canNext = currentVal.length >= minChars;

  if (type === 'main') {
    const isLast = state.currentQIdx >= roleQs.length - 1;
    return `
      <button class="btn btn-primary" ${canNext ? '' : 'disabled'} onclick="nextStep()">
        ${isLast ? '进入深度追问 →' : '下一题 →'}
      </button>
      <button class="btn btn-ghost" onclick="skipQuestion()">跳过</button>
    `;
  } else if (type === 'follow') {
    const isLastFollow = state.currentQIdx >= roleQs.length - 1;
    return `
      <button class="btn btn-blue" ${canNext ? '' : 'disabled'} onclick="nextStep()">
        ${isLastFollow ? '进入交叉审视 →' : '下一题追问 →'}
      </button>
      <button class="btn btn-ghost" onclick="skipFollow()">跳过追问</button>
      <button class="btn btn-ghost" onclick="regenerateReport()" style="margin-left:auto;">🏁 直接生成报告</button>
    `;
  } else if (type === 'cross') {
    const isLastCross = state.crossIdx >= CROSS_QUESTIONS.length - 1;
    return `
      <button class="btn btn-green" ${canNext ? '' : 'disabled'} onclick="nextCross()">
        ${isLastCross ? '🎯 生成定位报告' : '下一题 →'}
      </button>
      <button class="btn btn-ghost" onclick="skipCross()">跳过</button>
      ${isLastCross ? `<button class="btn btn-primary" onclick="regenerateReport()">🎯 立即生成报告</button>` : ''}
    `;
  }
  return '';
}

// ── 事件处理 ──

function onAnswerInput(field, el) {
  const val = el.value;
  if (field.endsWith('_follow')) {
    state.followups[field] = val;
  } else if (CROSS_QUESTIONS.find(c => c.field === field)) {
    state.crossAnswers[field] = val;
  } else {
    state.answers[field] = val;
  }
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
  const primaryBtns = btnsDiv.querySelectorAll('.btn-primary, .btn-blue, .btn-green');
  if (primaryBtns.length === 0) return;
  const minChars = getMinChars(field);
  const canNext = val.length >= minChars;
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
      if (q.field + '_follow' === field) return 8;
    }
  }
  const cq = CROSS_QUESTIONS.find(c => c.field === field);
  if (cq) return cq.minChars || 8;
  return 8;
}

function saveCurrentAnswer() {
  const inputs = document.querySelectorAll('.qa-input');
  inputs.forEach(el => {
    const field = el.id.replace('answer_', '');
    const val = el.value;
    if (field.endsWith('_follow')) state.followups[field] = val;
    else if (CROSS_QUESTIONS.find(c => c.field === field)) state.crossAnswers[field] = val;
    else state.answers[field] = val;
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
    if (field.endsWith('_follow')) state.followups[field] = val;
    else if (CROSS_QUESTIONS.find(c => c.field === field)) state.crossAnswers[field] = val;
    else state.answers[field] = val;
  }

  const roleQs = ROLE_QUESTIONS[state.role];
  if (!roleQs) { showToast('请先选择角色', 'error'); return; }

  if (state.currentStep === 0) {
    const qData = roleQs[state.currentQIdx];
    const ans = state.answers[qData.field] || '';
    if (ans.length < (qData.minChars || 10)) {
      showToast('请至少输入' + (qData.minChars || 10) + '个字再继续（或点击跳过）', 'error');
      return;
    }
    state.currentStep = 1;
  } else if (state.currentStep === 1) {
    const qData = roleQs[state.currentQIdx];
    const followField = qData.field + '_follow';
    const fans = state.followups[followField] || '';
    if (fans.length < 8) {
      showToast('请至少输入8个字再继续（或点击跳过追问）', 'error');
      return;
    }
    state.currentStep = 0;
    state.currentQIdx++;
    if (state.currentQIdx >= roleQs.length) {
      state.currentStep = 2;
      state.crossIdx = 0;
    }
  }

  saveProgress();
  renderCurrentQuestion();
  document.getElementById('qaArea').scrollIntoView({ behavior: 'smooth' });
}

function skipQuestion() {
  saveCurrentAnswer();
  state.currentStep = 0;
  state.currentQIdx++;
  const roleQs = ROLE_QUESTIONS[state.role];
  if (state.currentQIdx >= roleQs.length) {
    state.currentStep = 2;
    state.crossIdx = 0;
  }
  renderCurrentQuestion();
}

function skipFollow() {
  saveCurrentAnswer();
  state.currentStep = 0;
  state.currentQIdx++;
  const roleQs = ROLE_QUESTIONS[state.role];
  if (state.currentQIdx >= roleQs.length) {
    state.currentStep = 2;
    state.crossIdx = 0;
  }
  renderCurrentQuestion();
}

function nextCross() {
  saveCurrentAnswer();
  state.crossIdx++;
  if (state.crossIdx >= CROSS_QUESTIONS.length) {
    generateReport();
  } else {
    renderCurrentQuestion();
  }
}

function skipCross() {
  state.crossIdx++;
  if (state.crossIdx >= CROSS_QUESTIONS.length) generateReport();
  else renderCurrentQuestion();
}

function regenerateReport() {
  saveCurrentAnswer();
  generateReport();
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

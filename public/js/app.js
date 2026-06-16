/* ===== 应用启动入口 ===== */

(function init() {
  // 1. 检测语音支持
  const speechSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hdVoice = checkHDVoiceSupport();

  // 如果没有语音支持，降级处理将在页面渲染后执行
  if (!speechSupported) {
    setTimeout(hideVoiceButtons, 1000);
  }

  // 2. 检测AI服务可用性
  checkAIAvailability();

  // 3. 渲染角色选择器
  renderRoleSelector();

  // 4. 检查未完成进度
  checkSavedProgress();
})();

// ── 角色选择器 ──

function renderRoleSelector() {
  const grid = document.getElementById('roleGrid');
  grid.innerHTML = ROLES.map(r => `
    <div class="role-card ${state.role === r.id ? 'active' : ''}" onclick="selectRole('${r.id}')">
      <span class="role-icon">${r.icon}</span>
      <span class="role-name">${r.name}</span>
      <span class="role-desc">${r.desc}</span>
    </div>
  `).join('');
}

function selectRole(roleId) {
  clearProgress();
  state.role = roleId;
  state.currentQIdx = 0;
  state.answers = {};
  state.report = null;
  state.reportId = null;

  renderRoleSelector();
  document.getElementById('qaArea').style.display = 'block';
  document.getElementById('reportSection').classList.remove('show');
  document.getElementById('reportSection').innerHTML = '';
  document.getElementById('resumeBanner').style.display = 'none';

  renderCurrentQuestion();
  document.getElementById('qaArea').scrollIntoView({ behavior: 'smooth' });
}

// ── 进度恢复 ──

function checkSavedProgress() {
  const saved = loadProgress();
  if (!saved || !saved.role) return;

  const banner = document.getElementById('resumeBanner');
  banner.style.display = 'flex';
  banner.querySelector('p').textContent =
    `📝 检测到未完成的问答进度（角色：${getRoleLabel(saved.role)}，已回答 ${Object.keys(saved.answers || {}).filter(k => saved.answers[k]?.length >= 5).length} 个问题）`;

  document.getElementById('resumeBtn').onclick = () => {
    restoreProgress(saved);
    document.getElementById('resumeBanner').style.display = 'none';
    document.getElementById('qaArea').style.display = 'block';
    renderRoleSelector();
    renderCurrentQuestion();
    document.getElementById('qaArea').scrollIntoView({ behavior: 'smooth' });
  };

  document.getElementById('newSessionBtn').onclick = () => {
    clearProgress();
    banner.style.display = 'none';
  };
}

// ── 重置所有 ──

function resetAll() {
  clearProgress();
  document.getElementById('qaArea').style.display = 'none';
  document.getElementById('reportSection').classList.remove('show');
  document.getElementById('reportSection').innerHTML = '';
  document.getElementById('roleSection').scrollIntoView({ behavior: 'smooth' });
  renderRoleSelector();

  // 重新检查进度
  setTimeout(checkSavedProgress, 500);
}

// ── AI可用性检测 ──

async function checkAIAvailability() {
  try {
    const resp = await fetch(CONFIG.API_BASE + '/health', {
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json();
    if (!data.aiAvailable) {
      showOfflineIndicator();
    }
  } catch (e) {
    // 后端可能未启动或其他网络错误
    showOfflineIndicator();
  }
}

function showOfflineIndicator() {
  const indicator = document.getElementById('offlineIndicator');
  if (indicator) indicator.style.display = 'block';
}

// ── 语音不支持降级 ──

function hideVoiceButtons() {
  document.querySelectorAll('.mic-btn').forEach(b => {
    b.style.display = 'none';
  });
  document.querySelectorAll('.rec-indicator').forEach(e => {
    e.style.display = 'none';
  });
}

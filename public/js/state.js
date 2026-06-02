/* ===== 应用状态管理 + localStorage 持久化 ===== */

const state = {
  role: null,
  currentStep: 0,         // 0=主问题, 1=追问, 2=交叉问题, 3=生成报告
  currentQIdx: 0,
  crossIdx: 0,
  answers: {},            // {fieldId: answerText}
  followups: {},          // {fieldId_follow: answerText}
  crossAnswers: {},
  report: null,
  reportId: null,         // 保存到历史后的ID
};

// ── 进度持久化 ──

function saveProgress() {
  try {
    const data = {
      version: CONFIG.LS_VERSION,
      role: state.role,
      currentStep: state.currentStep,
      currentQIdx: state.currentQIdx,
      crossIdx: state.crossIdx,
      answers: state.answers,
      followups: state.followups,
      crossAnswers: state.crossAnswers,
      lastSavedAt: Date.now(),
    };
    localStorage.setItem(CONFIG.LS_PROGRESS, JSON.stringify(data));
  } catch (e) {
    console.warn('保存进度失败:', e.message);
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(CONFIG.LS_PROGRESS);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== CONFIG.LS_VERSION) {
      localStorage.removeItem(CONFIG.LS_PROGRESS);
      return null;
    }
    // 检查是否过期（超过24小时视为过期）
    if (Date.now() - data.lastSavedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CONFIG.LS_PROGRESS);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('加载进度失败:', e.message);
    return null;
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(CONFIG.LS_PROGRESS);
  } catch (e) { /* ignore */ }
  state.role = null;
  state.currentStep = 0;
  state.currentQIdx = 0;
  state.crossIdx = 0;
  state.answers = {};
  state.followups = {};
  state.crossAnswers = {};
  state.report = null;
  state.reportId = null;
}

function hasSavedProgress() {
  return !!loadProgress();
}

function restoreProgress(data) {
  state.role = data.role;
  state.currentStep = data.currentStep;
  state.currentQIdx = data.currentQIdx;
  state.crossIdx = data.crossIdx;
  state.answers = data.answers || {};
  state.followups = data.followups || {};
  state.crossAnswers = data.crossAnswers || {};
}

// ── 报告历史持久化 ──

function saveReportToHistory(report) {
  try {
    const history = getHistory();
    const entry = {
      id: uid(),
      timestamp: Date.now(),
      role: state.role,
      roleLabel: getRoleLabel(state.role),
      answers: { ...state.answers },
      followups: { ...state.followups },
      crossAnswers: { ...state.crossAnswers },
      analysis: report,
      isFavorite: false,
    };
    history.unshift(entry);

    // 限制历史数量
    if (history.length > CONFIG.MAX_HISTORY) {
      history.length = CONFIG.MAX_HISTORY;
    }

    localStorage.setItem(CONFIG.LS_HISTORY, JSON.stringify(history));
    state.reportId = entry.id;
    return entry.id;
  } catch (e) {
    console.warn('保存报告失败:', e.message);
    return null;
  }
}

function getHistory() {
  try {
    const raw = localStorage.getItem(CONFIG.LS_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function getHistoryById(id) {
  return getHistory().find(h => h.id === id);
}

function deleteHistory(id) {
  try {
    const history = getHistory().filter(h => h.id !== id);
    localStorage.setItem(CONFIG.LS_HISTORY, JSON.stringify(history));
    return true;
  } catch (e) {
    return false;
  }
}

function toggleFavorite(id) {
  try {
    const history = getHistory();
    const entry = history.find(h => h.id === id);
    if (entry) {
      entry.isFavorite = !entry.isFavorite;
      localStorage.setItem(CONFIG.LS_HISTORY, JSON.stringify(history));
      return entry.isFavorite;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function clearHistory() {
  try {
    localStorage.removeItem(CONFIG.LS_HISTORY);
  } catch (e) { /* ignore */ }
}

// ── 辅助 ──

function getRoleLabel(roleId) {
  const role = ROLES.find(r => r.id === roleId);
  return role ? role.name : '团队成员';
}

/** 获取所有已填写文本（用于AI分析） */
function getAllAnswerText() {
  return [
    ...Object.values(state.answers),
    ...Object.values(state.followups),
    ...Object.values(state.crossAnswers),
  ].filter(Boolean).join('\n');
}

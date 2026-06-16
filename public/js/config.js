/* ===== 应用配置 ===== */
const CONFIG = {
  // API地址（开发时同源，部署时可改为绝对路径）
  API_BASE: '/api',

  // 语音配置
  VOICE_SILENCE_TIMEOUT: 3000,  // 3秒不说话自动停止
  VOICE_TARGET_SAMPLE_RATE: 16000,

  // AI分析配置
  AI_TIMEOUT: 30000,           // 30秒超时
  AI_RETRY_COUNT: 1,           // 失败重试次数
  AI_RETRY_DELAY: 2000,        // 重试间隔(ms)

  // 输入配置
  MIN_CHARS_MAIN: 10,          // 主问题最少字数
  MIN_CHARS_FOLLOW: 8,         // 追问最少字数
  MIN_CHARS_CROSS: 5,          // 交叉问题最少字数

  // localStorage键名
  LS_PROGRESS: 'tarot_compass_progress',
  LS_HISTORY: 'tarot_compass_history',
  LS_VERSION: 3,

  // 历史记录上限
  MAX_HISTORY: 100,
};

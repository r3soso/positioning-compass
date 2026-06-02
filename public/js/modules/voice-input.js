/* ===== 混合语音输入引擎 =====
 * Web Speech API (实时预览) + MediaRecorder (录音→后端Whisper高精度转写)
 */

let recognition = null;
let mediaRecorder = null;
let audioChunks = [];
let currentVoiceField = null;
let voiceTimeout = null;
let hdVoiceSupported = false;    // 是否支持MediaRecorder（HD语音）
let isRecording = false;

// ── 初始化 ──

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return false;

  recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = handleSpeechResult;
  recognition.onerror = handleSpeechError;
  recognition.onend = handleSpeechEnd;
  recognition.onspeechstart = () => {
    clearTimeout(voiceTimeout);
    updateRecIndicator(currentVoiceField, true, '正在聆听...');
  };
  recognition.onspeechend = () => {
    updateRecIndicator(currentVoiceField, true, '聆听中...（3秒不说话自动提交）');
    clearTimeout(voiceTimeout);
    voiceTimeout = setTimeout(() => {
      if (isRecording) stopVoice(true);
    }, CONFIG.VOICE_SILENCE_TIMEOUT);
  };

  return true;
}

function initMediaRecorder() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  return true;
}

function checkHDVoiceSupport() {
  hdVoiceSupported = !!(navigator.mediaDevices?.getUserMedia && (
    window.MediaRecorder || window.webkitMediaRecorder
  ));
  return hdVoiceSupported;
}

// ── 语音识别结果处理 ──

function handleSpeechResult(event) {
  if (!currentVoiceField) return;

  const preview = document.getElementById('preview_' + currentVoiceField);
  if (!preview) return;

  let finalText = '';

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const transcript = result[0].transcript.trim();
    if (result.isFinal) {
      const filtered = filterSpeech(transcript);
      finalText += filtered + ' ';
    } else {
      // 中间结果显示为灰色斜体
      const interimEl = preview.querySelector('.interim-text') || document.createElement('span');
      interimEl.className = 'interim-text interim';
      interimEl.textContent = transcript + ' ';
      if (!preview.contains(interimEl)) preview.appendChild(interimEl);
    }
  }

  // 写入最终结果
  if (finalText) {
    let finalEl = preview.querySelector('.final-text');
    if (!finalEl) {
      finalEl = document.createElement('span');
      finalEl.className = 'final-text';
      preview.appendChild(finalEl);
    }
    finalEl.textContent += finalText;

    const textarea = document.getElementById('answer_' + currentVoiceField);
    if (textarea) {
      textarea.value = finalEl.textContent;
      textarea.classList.add('filled');
      onAnswerInput(currentVoiceField, textarea);
    }
  }

  preview.classList.add('show');
}

function handleSpeechError(event) {
  console.log('语音识别错误:', event.error);
  if (event.error === 'not-allowed') {
    showToast('请允许麦克风权限后重试', 'error');
  } else if (event.error === 'no-speech') {
    if (currentVoiceField) updateRecIndicator(currentVoiceField, true, '未检测到语音，请继续...');
  }
  // aborted → 用户主动停止，不处理
}

function handleSpeechEnd() {
  if (isRecording && recognition) {
    try { recognition.start(); } catch (e) { /* 已在运行 */ }
  }
}

// ── 语音控制 ──

async function toggleVoice(field, btn) {
  if (currentVoiceField === field && isRecording) {
    await stopVoice(true);
    return;
  }

  // 如果正在其他field录音，先停止
  if (isRecording && currentVoiceField && currentVoiceField !== field) {
    await stopVoice(false);
  }

  // 首次初始化
  if (!recognition && !initSpeechRecognition()) {
    showToast('你的浏览器不支持语音输入，请使用Chrome或Edge浏览器', 'error');
    return;
  }

  await startVoice(field, btn);
}

async function startVoice(field, btn) {
  currentVoiceField = field;

  // 重置所有mic按钮
  document.querySelectorAll('.mic-btn').forEach(b => b.classList.remove('recording'));
  btn.classList.add('recording');
  const statusEl = btn.querySelector('.mic-status');
  if (statusEl) statusEl.textContent = '点击停止';

  // 显示录制指示器
  document.querySelectorAll('.rec-indicator').forEach(e => e.classList.remove('show'));
  updateRecIndicator(field, true, '正在聆听...（自由说话，说完自动提交）');

  // 清空预览区
  const preview = document.getElementById('preview_' + field);
  if (preview) { preview.innerHTML = ''; preview.classList.add('show'); }

  // 启动Web Speech
  clearTimeout(voiceTimeout);
  try {
    recognition.start();
  } catch (e) { /* 可能已在运行 */ }

  // 启动MediaRecorder（HD语音）
  if (hdVoiceSupported) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.start(1000); // 每秒收集一次数据
    } catch (e) {
      console.warn('MediaRecorder启动失败，使用普通语音模式:', e.message);
      hdVoiceSupported = false;
    }
  }

  isRecording = true;
  showToast(hdVoiceSupported ? '🎤 HD语音已启动，请自由说话...' : '🎤 正在聆听，请自由说话...', 'info');
}

async function stopVoice(autoSubmit = false) {
  isRecording = false;

  // 停止Web Speech
  if (recognition) {
    try { recognition.stop(); } catch (e) { /* ignore */ }
  }
  clearTimeout(voiceTimeout);

  // 停止MediaRecorder
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    if (mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
  }

  // 重置UI
  document.querySelectorAll('.mic-btn').forEach(b => {
    b.classList.remove('recording');
    const status = b.querySelector('.mic-status');
    if (status) status.textContent = '语音输入';
  });
  document.querySelectorAll('.rec-indicator').forEach(e => e.classList.remove('show'));

  // 提交Web Speech结果到textarea
  if (currentVoiceField) {
    const preview = document.getElementById('preview_' + currentVoiceField);
    const textarea = document.getElementById('answer_' + currentVoiceField);
    if (preview && textarea) {
      const finalText = preview.querySelector('.final-text');
      if (finalText && finalText.textContent.trim()) {
        textarea.value = finalText.textContent.trim();
        textarea.classList.add('filled');
        onAnswerInput(currentVoiceField, textarea);
      }
      preview.classList.remove('show');
    }
  }

  // 如果有MediaRecorder音频，上传到后端进行高精度转写
  if (audioChunks.length > 0 && currentVoiceField) {
    await uploadAudioForTranscription(currentVoiceField);
  }

  const field = currentVoiceField;
  currentVoiceField = null;
  mediaRecorder = null;

  if (autoSubmit) {
    showToast('✅ 语音输入已自动提交', 'success');
  }
}

// ── 音频上传与转写 ──

async function uploadAudioForTranscription(field) {
  if (audioChunks.length === 0) return;

  try {
    showToast('🔍 正在高精度转写...', 'info');

    let audioBlob;
    try {
      audioBlob = await convertToWav(audioChunks, CONFIG.VOICE_TARGET_SAMPLE_RATE);
    } catch (e) {
      // WAV转换失败，使用原始格式
      console.warn('WAV转换失败，使用原始格式:', e.message);
      const mimeType = audioChunks[0]?.type || 'audio/webm';
      audioBlob = new Blob(audioChunks, { type: mimeType });
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    const resp = await fetch(CONFIG.API_BASE + '/voice/transcribe', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(CONFIG.AI_TIMEOUT),
    });

    const result = await resp.json();

    if (!result.error && result.text && !result.fallback) {
      // 成功获取高精度转写，替换textarea内容
      const textarea = document.getElementById('answer_' + field);
      if (textarea) {
        textarea.value = result.text;
        textarea.classList.add('filled');
        onAnswerInput(field, textarea);
      }
      showToast('✅ 高精度转写完成', 'success');
    } else if (result.fallback) {
      // 后端回退，Web Speech结果已在使用
      console.log('语音转写回退:', result.message);
    }
  } catch (e) {
    console.warn('音频上传失败，使用Web Speech结果:', e.message);
  } finally {
    audioChunks = [];
  }
}

function updateRecIndicator(field, show, text) {
  const ind = document.getElementById('recInd_' + field);
  if (!ind) return;
  if (show) {
    ind.classList.add('show');
    if (text) ind.innerHTML = '<span class="rec-dot"></span>' + text;
  } else {
    ind.classList.remove('show');
  }
}

// ── 键盘快捷键 ──

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
    e.preventDefault();
    const micBtns = document.querySelectorAll('.mic-btn');
    const visibleBtn = Array.from(micBtns).find(b => b.offsetParent !== null);
    if (visibleBtn) {
      const field = visibleBtn.id.replace('mic_', '');
      toggleVoice(field, visibleBtn);
    }
  }
});

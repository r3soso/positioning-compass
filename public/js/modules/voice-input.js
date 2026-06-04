/* ===== 语音输入引擎 v3 =====
 * 模式 A: Web Speech（Google 可连时，实时预览）+ Whisper 优化
 * 模式 B: MediaRecorder 录音 + Cloudflare AI Whisper 转写（国内可用）
 * 自动检测并切换
 */

let recognition = null;
let mediaRecorder = null;
let audioChunks = [];
let currentVoiceField = null;
let voiceTimeout = null;
let hdVoiceSupported = false;
let isRecording = false;
let webSpeechDisabled = false; // 国内 Google 被墙时自动禁用

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
    updateRecIndicator(currentVoiceField, true, '聆听中...（说完自动提交）');
    clearTimeout(voiceTimeout);
    voiceTimeout = setTimeout(() => {
      if (isRecording) stopVoice(true);
    }, CONFIG.VOICE_SILENCE_TIMEOUT || 3000);
  };

  return true;
}

function checkHDVoiceSupport() {
  hdVoiceSupported = !!(navigator.mediaDevices?.getUserMedia && (
    window.MediaRecorder || window.webkitMediaRecorder
  ));
  return hdVoiceSupported;
}

// ── Speech 结果处理 ──

function handleSpeechResult(event) {
  if (!currentVoiceField) return;
  const preview = document.getElementById('preview_' + currentVoiceField);
  if (!preview) return;

  let finalText = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const transcript = result[0].transcript.trim();
    if (result.isFinal) {
      finalText += filterSpeech(transcript) + ' ';
    } else {
      let interimEl = preview.querySelector('.interim-text');
      if (!interimEl) {
        interimEl = document.createElement('span');
        interimEl.className = 'interim-text interim';
        preview.appendChild(interimEl);
      }
      interimEl.textContent = transcript;
    }
  }

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
    forceStopVoice();
  } else if (event.error === 'network' || event.error === 'service-not-allowed') {
    // Google 被墙，标记禁用 Web Speech，改用纯录音模式
    webSpeechDisabled = true;
    updateRecIndicator(currentVoiceField, true, '录音中... 停止后 AI 自动转写');
    // 不强制停止，让录音继续进行
  } else if (event.error === 'no-speech') {
    updateRecIndicator(currentVoiceField, true, '未检测到语音，请继续说话...');
  }
}

let speechRestartCount = 0;

function handleSpeechEnd() {
  if (isRecording && recognition && !webSpeechDisabled && speechRestartCount < 3) {
    speechRestartCount++;
    setTimeout(() => {
      try { if (isRecording && !webSpeechDisabled) recognition.start(); } catch (e) {}
    }, 200);
  }
}

// ── 语音控制 ──

async function toggleVoice(field, btn) {
  if (currentVoiceField === field && isRecording) {
    await stopVoice(true);
    return;
  }

  if (isRecording && currentVoiceField && currentVoiceField !== field) {
    await stopVoice(false);
  }

  await startVoice(field, btn);
}

async function startVoice(field, btn) {
  currentVoiceField = field;
  speechRestartCount = 0;

  // UI
  document.querySelectorAll('.mic-btn').forEach(b => b.classList.remove('recording'));
  btn.classList.add('recording');
  const statusEl = btn.querySelector('.mic-status');
  if (statusEl) statusEl.textContent = '点击停止';
  document.querySelectorAll('.rec-indicator').forEach(e => e.classList.remove('show'));
  updateRecIndicator(field, true, '正在聆听...（点击麦克风停止）');
  const preview = document.getElementById('preview_' + field);
  if (preview) { preview.innerHTML = ''; preview.classList.add('show'); }

  // 自动设置最长录音时间（30秒）
  clearTimeout(voiceTimeout);
  voiceTimeout = setTimeout(() => {
    if (isRecording) {
      showToast('已录音30秒，自动停止', 'info');
      stopVoice(true);
    }
  }, 30000);

  // Web Speech（国外可用，国内自动降级）
  if (!recognition && !initSpeechRecognition()) {
    webSpeechDisabled = true;
  }
  if (!webSpeechDisabled) {
    try { recognition.start(); } catch (e) { webSpeechDisabled = true; }
  }

  // MediaRecorder 录音（核心，国内国外都靠它 + Whisper）
  if (hdVoiceSupported || checkHDVoiceSupport()) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.start(1000);
    } catch (e) {
      console.warn('MediaRecorder 启动失败:', e.message);
      showToast('无法访问麦克风，请检查浏览器权限', 'error');
      forceStopVoice();
      return;
    }
  } else {
    showToast('你的浏览器不支持录音，请使用 Chrome 或 Edge', 'error');
    forceStopVoice();
    return;
  }

  isRecording = true;
  showToast('🎤 正在录音，说完点击麦克风停止', 'info');
}

async function stopVoice(autoSubmit = false) {
  isRecording = false;
  webSpeechDisabled = false;
  speechRestartCount = 99; // 阻止重试

  // 停止 Web Speech
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }
  clearTimeout(voiceTimeout);

  // 停止 MediaRecorder
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
      }
    } catch (e) {}
  }

  // 重置 UI
  document.querySelectorAll('.mic-btn').forEach(b => {
    b.classList.remove('recording');
    const status = b.querySelector('.mic-status');
    if (status) status.textContent = '语音输入';
  });
  document.querySelectorAll('.rec-indicator').forEach(e => e.classList.remove('show'));

  // 提交 Web Speech 实时预览文本（如果有的话）
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
      preview.innerHTML = '';
    }
  }

  // 上传录音到 Cloudflare AI Whisper 进行高精度转写
  if (audioChunks.length > 0 && currentVoiceField) {
    showToast('🔍 AI 正在转写语音...', 'info');
    await uploadAudioForTranscription(currentVoiceField);
  }

  const field = currentVoiceField;
  currentVoiceField = null;
  mediaRecorder = null;
  audioChunks = [];

  if (autoSubmit && audioChunks.length === 0) {
    showToast('✅ 语音输入已提交', 'success');
  }
}

// ── 音频上传与转写 ──

async function uploadAudioForTranscription(field) {
  if (audioChunks.length === 0) return;

  try {
    let audioBlob;
    try {
      audioBlob = await convertToWav(audioChunks, CONFIG.VOICE_TARGET_SAMPLE_RATE);
    } catch (e) {
      const mimeType = audioChunks[0]?.type || 'audio/webm';
      audioBlob = new Blob(audioChunks, { type: mimeType });
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    const resp = await fetch(CONFIG.API_BASE + '/voice/transcribe', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(CONFIG.AI_TIMEOUT || 30000),
    });

    const result = await resp.json();

    if (!result.error && result.text && !result.fallback) {
      const textarea = document.getElementById('answer_' + field);
      if (textarea) {
        textarea.value = result.text;
        textarea.classList.add('filled');
        onAnswerInput(field, textarea);
      }
      showToast('✅ AI 转写完成', 'success');
    } else if (result.fallback) {
      showToast('⚠️ 语音转写不可用：' + (result.message || '服务未配置'), 'info');
    }
  } catch (e) {
    console.warn('音频上传失败:', e.message);
    showToast('⚠️ 语音转写失败，请手动输入', 'error');
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

// ── 强制停止 ──

function forceStopVoice() {
  isRecording = false;
  speechRestartCount = 99;
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
      }
    } catch (e) {}
  }
  clearTimeout(voiceTimeout);
  document.querySelectorAll('.mic-btn').forEach(b => {
    b.classList.remove('recording');
    const status = b.querySelector('.mic-status');
    if (status) status.textContent = '语音输入';
  });
  document.querySelectorAll('.rec-indicator').forEach(e => e.classList.remove('show'));
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

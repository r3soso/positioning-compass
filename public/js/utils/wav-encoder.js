/* ===== WAV 音频编码工具 ===== */

/**
 * 将 MediaRecorder 录制的音频 chunks 编码为 WAV Blob
 * WAV 格式: 44字节 PCM header + raw audio data
 *
 * @param {Float32Array|Int16Array} samples - 音频采样数据
 * @param {number} sampleRate - 采样率 (如 16000)
 * @param {number} numChannels - 声道数 (默认1)
 * @returns {Blob} WAV格式的Blob
 */
function encodeWAV(samples, sampleRate, numChannels = 1) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, numChannels, true); // channels
  view.setUint32(24, sampleRate, true);  // sample rate
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true);  // block align
  view.setUint16(34, 16, true);          // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * 将 MediaRecorder 产生的 Blob 数组合并并转换为 WAV
 * 支持 WebM/opus → 通过 AudioContext 解码 → 重采样为 PCM → WAV
 *
 * @param {Blob[]} chunks - MediaRecorder 的 dataavailable chunks
 * @param {number} targetSampleRate - 目标采样率 (默认16000，适合Whisper)
 * @returns {Promise<Blob>} WAV格式Blob
 */
async function convertToWav(chunks, targetSampleRate = 16000) {
  const mimeType = chunks[0]?.type || 'audio/webm';
  const blob = new Blob(chunks, { type: mimeType });

  // 解码音频
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: targetSampleRate });
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // 如果是多声道，取第一声道
  const channelData = audioBuffer.getChannelData(0);

  // 如果采样率不同，需要重采样
  let samples = channelData;
  if (audioBuffer.sampleRate !== targetSampleRate) {
    samples = resample(channelData, audioBuffer.sampleRate, targetSampleRate);
  }

  audioCtx.close();
  return encodeWAV(samples, targetSampleRate, 1);
}

/**
 * 简单线性重采样
 */
function resample(data, fromRate, toRate) {
  const ratio = fromRate / toRate;
  const newLength = Math.round(data.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const srcIdxFloor = Math.floor(srcIdx);
    const frac = srcIdx - srcIdxFloor;
    const a = data[srcIdxFloor] || 0;
    const b = data[Math.min(srcIdxFloor + 1, data.length - 1)] || 0;
    result[i] = a + (b - a) * frac;
  }
  return result;
}

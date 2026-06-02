/* ===== 口语过滤引擎 ===== */

// 口语化表达的过滤
const FILLER_PATTERNS = [
  /嗯+/g, /啊+/g, /哦+/g, /呃+/g, /那个/g, /这个/g, /就是说/g,
  /然后呢/g, /对吧/g, /你懂的/g, /怎么说呢/g, /其实吧/g,
  /我觉得吧/g, /就是说啊/g, /那个啥/g,
];

// 语音识别常见错误修正
const SPEECH_CORRECTIONS = {
  '定外': '定位', '心制': '心智', '差一花': '差异化',
  '敬品': '竞品', '脉点': '卖点', '克户': '客户',
  '消受': '销售', '门电': '门店', '守候': '售后',
  '品排': '品牌', '市厂': '市场', '产贫': '产品',
};

/**
 * 过滤口语化文本
 * @param {string} text - 原始文本
 * @returns {string} 过滤后的文本
 */
function filterSpeech(text) {
  if (!text || text.length < 2) return text;

  let filtered = text.trim();

  // 1. 去口语化填充词
  FILLER_PATTERNS.forEach(pattern => {
    filtered = filtered.replace(pattern, '');
  });

  // 2. 去连续重复字（如"我我我觉得" → "我觉得"）
  filtered = filtered.replace(/(.)\1{2,}/g, (match, char) => {
    if (match.length <= 2) return match;
    return char + char;
  });

  // 3. 语音识别常见错词修正
  Object.entries(SPEECH_CORRECTIONS).forEach(([wrong, correct]) => {
    filtered = filtered.replace(new RegExp(wrong, 'g'), correct);
  });

  // 4. 去除多余空格
  filtered = filtered.replace(/\s+/g, ' ').trim();

  // 5. 中文标点规范化
  filtered = filtered
    .replace(/[,]/g, '，')
    .replace(/[.]/g, '。')
    .replace(/[!]/g, '！')
    .replace(/[?]/g, '？')
    .replace(/[;]/g, '；');

  // 6. 去句首句尾无效标点
  filtered = filtered.replace(/^[，。！？；、\s]+/, '');
  filtered = filtered.replace(/[，。！？；、\s]+$/, '');

  // 7. 确保以标点结尾
  if (filtered.length > 5 && !/[。！？；]$/.test(filtered)) {
    filtered += '。';
  }

  return filtered;
}

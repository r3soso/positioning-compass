/* ===== DOM 操作工具 ===== */
const $ = (sel, parent) => (parent || document).querySelector(sel);
const $$ = (sel, parent) => [...(parent || document).querySelectorAll(sel)];
const createEl = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'innerHTML') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  children.forEach(c => el.append(typeof c === 'string' ? document.createTextNode(c) : c));
  return el;
};
const removeAll = sel => $$(sel).forEach(el => el.remove());

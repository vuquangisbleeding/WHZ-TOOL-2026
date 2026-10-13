const PROCESS_URL = 'https://autocaptcha.pro/apiv3/process';
const CAPTCHA_SLOW_MS = 180000;
const SPEECH_TIMEOUT_MS = CAPTCHA_SLOW_MS;

function speechRequestBody(key, audioBase64) {
  return { key, type: 'speechtotext', body: audioBase64 };
}

function recaptchaV2RequestBody(key, sitekey, pageurl) {
  return { key, type: 'recaptchav2', googlesitekey: sitekey, pageurl };
}

function recaptchaTokenPayload(key, info = {}) {
  const sitekey = info.sitekey || '';
  const pageurl = info.url || '';
  if (/\/recaptcha\/enterprise\//i.test(info.iframeSrc || '')) {
    const body = { key, type: 'recaptchav2enterpire', googlesitekey: sitekey, pageurl };
    if (info.invisible) body.invi = '1';
    return body;
  }
  const body = recaptchaV2RequestBody(key, sitekey, pageurl);
  if (info.invisible) body.invi = '1';
  return body;
}

function formatAutocaptchaProxy(proxy) {
  if (!proxy) return '';
  if (typeof proxy === 'string') {
    const value = proxy.trim();
    if (!value) return '';
    if (!value.includes('://')) return value;
    proxy = { server: value };
  }
  try {
    const server = String(proxy.server || '');
    const url = new URL(server.includes('://') ? server : `http://${server}`);
    const user = proxy.username || (url.username ? decodeURIComponent(url.username) : '');
    const pass = proxy.password || (url.password ? decodeURIComponent(url.password) : '');
    if (!url.hostname || !url.port) return '';
    return user ? `${url.hostname}:${url.port}:${user}:${pass}` : `${url.hostname}:${url.port}`;
  } catch {
    return '';
  }
}

function imageField(value) {
  const raw = String(value || '').trim();
  if (raw.startsWith('<svg')) return `data:image/svg+xml;base64,${Buffer.from(raw).toString('base64')}`;
  return raw;
}

function captchaRequestBody(key, info = {}) {
  const pageurl = info.url || info.pageurl || '';
  const sitekey = info.sitekey || '';
  const proxy = info.proxy || '';
  switch (info.kind) {
    case 'recaptcha_v2':
    case 'recaptcha':
      return recaptchaTokenPayload(key, info);
    case 'recaptcha_v3': {
      const body = { key, type: 'recaptchav3', googlesitekey: sitekey, pageurl, score: Number(info.score || 0.9) };
      if (info.action) body.actionv3 = info.action;
      if (proxy) body.proxy = proxy;
      return body;
    }
    case 'hcaptcha':
      return { key, type: 'hcaptcha', websitekey: sitekey, pageurl };
    case 'turnstile':
      return { key, type: 'cloudflare', websitekey: sitekey, pageurl };
    case 'funcaptcha':
      return { key, type: 'funcaptcha', websitekey: sitekey, pageurl, blob: info.blob || '' };
    case 'funcaptcha_image':
      return { key, type: 'compleximagetask', class: 'funcaptcha', imagesBase64: [info.image] };
    case 'geetest':
      return { key, type: 'geetest', pageurl, gt: info.gt || '', challenge: info.challenge || '' };
    case 'geetest_v4':
      return { key, type: 'geetestv4', pageurl, captchaId: info.captchaId || '' };
    case 'mtcaptcha': {
      const body = { key, type: 'mtcaptcha', websitekey: sitekey, pageurl };
      if (proxy) body.proxy = proxy;
      return body;
    }
    case 'getcode':
      return { key, type: 'getcode', img: imageField(info.image) };
    case 'speech':
      return speechRequestBody(key, info.audio || '');
    case 'imagetotext': {
      const body = { key, type: 'imagetotext', img: imageField(info.image), casesensitive: false };
      if (info.colors) body.colors = info.colors;
      return body;
    }
    default:
      throw new Error(`Chưa có kiểu captcha ${info.kind || 'unknown'}`);
  }
}

function recaptchaImageRequestBody(key, { image, task, grid }) {
  return {
    key,
    type: 'compleximagetask',
    convert: false,
    class: 'recaptcha',
    imagesBase64: [image],
    metadata: { Task: task, Grid: grid }
  };
}

function parseTileAnswer(value) {
  let items = value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text.startsWith('[')) return null;
    try { items = JSON.parse(text); } catch { return null; }
  }
  if (!Array.isArray(items)) return null;
  return items.map(item => item === true || item === 'true');
}

function readCaptchaAnswer(data) {
  if (!data || data.success !== true) throw new Error(data?.message || 'Autocaptcha từ chối yêu cầu');
  const captcha = data.captcha;
  if (captcha && typeof captcha === 'object') {
    if (captcha.token || captcha.pass_token || captcha.validate || captcha.captcha_output) return captcha;
    throw new Error(data.message || 'Autocaptcha không trả kết quả');
  }
  const text = String(captcha ?? '').trim();
  if (!text || text === 'ERROR') throw new Error(data.message || 'Autocaptcha không trả kết quả');
  return text;
}

function speechAnswer(data) {
  const captcha = readCaptchaAnswer(data);
  if (typeof captcha !== 'string') throw new Error('Autocaptcha không trả lời thoại');
  return captcha;
}

function injectRecaptchaToken(token, root = globalThis) {
  for (const element of root.document.querySelectorAll('textarea[name="g-recaptcha-response"], textarea#g-recaptcha-response')) {
    element.value = token;
  }
  const clients = root.___grecaptcha_cfg?.clients;
  const seen = new Set();
  const visit = (node, depth) => {
    if (!node || typeof node !== 'object' || seen.has(node) || depth > 6) return;
    seen.add(node);
    let callback;
    try {
      callback = node.callback;
    } catch {
      return;
    }
    if (typeof callback === 'function') {
      try { callback(token); } catch { /* callback của widget có thể chạm frame khác origin */ }
    }
    let children;
    try {
      children = Object.values(node);
    } catch {
      return;
    }
    for (const child of children) visit(child, depth + 1);
  };
  visit(clients, 0);
}

function showCaptchaKey(key, source, root = globalThis) {
  const document = root.document;
  if (!document?.getElementById || !document.createElement) return;
  const id = 'inz-captcha-key';
  let box = document.getElementById(id);
  if (!box) {
    box = document.createElement('div');
    box.id = id;
    box.setAttribute('style', 'position:fixed;z-index:2147483647;top:12px;right:12px;max-width:min(440px,calc(100vw - 24px));padding:10px 12px;border-radius:8px;background:#111827;color:#fff;font:600 13px/1.45 ui-sans-serif,sans-serif;word-break:break-all;box-shadow:0 8px 24px rgba(0,0,0,.35)');
    (document.body || document.documentElement).appendChild(box);
  }
  const from = source === 'whitelist' ? 'whitelist' : 'cài đặt';
  box.textContent = `Autocaptcha API key (${from}): ${key}`;
}

async function postProcess({ payload, fetchImpl = fetch, timeoutMs = SPEECH_TIMEOUT_MS, timeoutMessage = 'Autocaptcha hết thời gian chờ' }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(PROCESS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch {
      throw new Error(`Autocaptcha HTTP ${response.status}`);
    }
    const answer = readCaptchaAnswer(data);
    return { text: typeof answer === 'string' ? answer : JSON.stringify(answer), captcha: answer, message: data.message || '' };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(timeoutMessage);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function transcribeSpeech({ key, body, fetchImpl = fetch, timeoutMs = SPEECH_TIMEOUT_MS }) {
  return postProcess({
    payload: speechRequestBody(key, body),
    fetchImpl,
    timeoutMs,
    timeoutMessage: 'Autocaptcha hết thời gian chờ audio'
  });
}

async function solveRecaptchaToken({ key, sitekey, pageurl, fetchImpl = fetch, timeoutMs = CAPTCHA_SLOW_MS }) {
  return postProcess({
    payload: recaptchaV2RequestBody(key, sitekey, pageurl),
    fetchImpl,
    timeoutMs,
    timeoutMessage: 'Autocaptcha hết thời gian chờ reCAPTCHA'
  });
}

function challengeFrame(page) {
  return page.frames().find(frame => /\/recaptcha\/(?:api2|enterprise)\/bframe/i.test(frame.url()));
}

async function readImageChallenge(frame) {
  return frame.evaluate(() => {
    const task = (document.querySelector('.rc-imageselect-instructions, .rc-imageselect-desc-wrapper')?.innerText || '').replace(/\s+/g, ' ').trim();
    const tiles = [...document.querySelectorAll('.rc-imageselect-tile')];
    const tableClass = document.querySelector('table.rc-imageselect-table')?.className || '';
    const grid = /44/.test(tableClass) || tiles.length >= 16 ? '4x4' : '3x3';
    const selected = tiles.map(tile => tile.classList.contains('rc-imageselect-tileselected') || tile.getAttribute('aria-pressed') === 'true');
    const audio = document.querySelector('#audio-source, .rc-audiochallenge-tdownload-link, audio source, audio');
    const audioSrc = audio?.src || audio?.getAttribute('src') || '';
    const audioChallenge = Boolean(document.querySelector('#audio-response, .rc-audiochallenge'));
    return { task, grid, tileCount: tiles.length, selected, audioSrc, audioChallenge };
  });
}

async function screenshotGrid(frame) {
  const handle = await frame.$('.rc-imageselect-payload, table.rc-imageselect-table');
  if (!handle) throw new Error('Không thấy ảnh reCAPTCHA');
  const shot = await handle.screenshot({ encoding: 'base64' });
  return Buffer.isBuffer(shot) ? shot.toString('base64') : String(shot);
}

async function clickTiles(frame, answers, selected) {
  const tiles = await frame.$$('.rc-imageselect-tile');
  let clicks = 0;
  for (let index = 0; index < answers.length && index < tiles.length; index += 1) {
    if (!answers[index] || selected[index]) continue;
    await tiles[index].click({ delay: 30 });
    clicks += 1;
  }
  return clicks;
}

async function clickVerify(frame) {
  const button = await frame.$('#recaptcha-verify-button');
  if (!button) return false;
  const disabled = await frame.evaluate(element => Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true', button).catch(() => false);
  if (disabled) return false;
  await button.click({ delay: 30 });
  return true;
}

async function waitForImageChallenge(page, { isCancelled, isSolved, wait, now = Date.now, deadlineMs = 8000 }) {
  const started = now();
  while (!isCancelled() && now() - started < deadlineMs) {
    if (await isSolved()) return { solved: true };
    const frame = challengeFrame(page);
    const state = frame ? await readImageChallenge(frame).catch(() => null) : null;
    if (state?.tileCount && state.task) return { frame, state };
    if (state?.audioChallenge) return { frame, state, audio: true };
    await wait(200);
  }
  return { solved: await isSolved() };
}

async function requestRecaptchaToken({ page, info, key, isCancelled, isSolved, onUpdate, post, wait }) {
  const token = await post({
    payload: recaptchaTokenPayload(key, info),
    timeoutMs: CAPTCHA_SLOW_MS,
    timeoutMessage: 'Autocaptcha hết thời gian chờ reCAPTCHA'
  });
  if (isCancelled() || await isSolved()) return;
  if (parseTileAnswer(token.captcha)) return;
  await page.evaluate(injectRecaptchaToken, String(token.captcha));
  onUpdate('token', { length: String(token.captcha).length });
  await wait(400);
}

async function solveImageChallenge(page, frame, { key, isCancelled, isSolved, onUpdate, post, wait }) {
  for (let round = 0; round < 4; round += 1) {
    if (isCancelled() || await isSolved()) return;
    frame = challengeFrame(page) || frame;
    const state = await readImageChallenge(frame);
    if (!state.tileCount || !state.task) return;
    const image = await screenshotGrid(frame);
    const solved = await post({
      payload: recaptchaImageRequestBody(key, { image, task: state.task, grid: state.grid }),
      timeoutMs: CAPTCHA_SLOW_MS,
      timeoutMessage: 'Autocaptcha hết thời gian chờ ảnh reCAPTCHA'
    });
    if (isCancelled()) return;
    const answers = parseTileAnswer(solved.captcha);
    if (!answers) throw new Error('Autocaptcha không trả danh sách ô ảnh');
    const clicks = await clickTiles(frame, answers, state.selected);
    onUpdate('image', { round: round + 1, grid: state.grid, selected: answers.filter(Boolean).length, clicks });
    if (!answers.some(Boolean) || state.grid === '4x4') {
      await wait(300);
      await clickVerify(frame);
      return;
    }
    await wait(1200);
  }
  if (!isCancelled()) await clickVerify(frame);
}

async function readAudioBase64(url, root = globalThis) {
  const response = await root.fetch(url);
  if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  const size = 8192;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + size));
  }
  return root.btoa(binary);
}

async function audioBase64FromFrame(frame, src) {
  return frame.evaluate(readAudioBase64, src);
}

async function solveRecaptchaAudio(frame, { key, isCancelled, isSolved, onUpdate, post, wait }) {
  let src = '';
  for (let attempt = 0; attempt < 10 && !src; attempt += 1) {
    const state = await readImageChallenge(frame);
    src = state.audioSrc || '';
    if (!src) await wait(300);
  }
  if (!src) throw new Error('Không thấy audio reCAPTCHA');
  const body = await audioBase64FromFrame(frame, src);
  if (isCancelled() || await isSolved()) return;
  const solved = await post({
    payload: speechRequestBody(key, body),
    timeoutMs: SPEECH_TIMEOUT_MS,
    timeoutMessage: 'Autocaptcha hết thời gian chờ audio'
  });
  if (isCancelled()) return;
  const text = String(solved.captcha || solved.text || '').trim();
  if (!text) throw new Error('Autocaptcha không trả lời thoại');
  await frame.evaluate(value => {
    const input = document.querySelector('#audio-response');
    if (!input) return;
    input.value = value;
  }, text);
  onUpdate('speech', { length: text.length });
  await wait(300);
  await clickVerify(frame);
}

async function solveRecaptchaOnPage({ page, info, apiKey, source = 'whitelist', isCancelled = () => false, isSolved = async () => false, onUpdate = () => {}, post = postProcess, wait = (ms => new Promise(resolve => setTimeout(resolve, ms))), now = Date.now }) {
  const key = String(apiKey || '').trim();
  if (!key) {
    onUpdate('skip', { reason: 'missing_api_key' });
    return;
  }
  onUpdate('key', { source, key });
  const tokenTask = info.sitekey && info.url
    ? requestRecaptchaToken({ page, info, key, isCancelled, isSolved, onUpdate, post, wait }).catch(error => {
      if (!isCancelled()) onUpdate('token_failed', { message: error.message });
    })
    : Promise.resolve();
  const found = await waitForImageChallenge(page, { isCancelled, isSolved, wait, now, deadlineMs: CAPTCHA_SLOW_MS });
  if (isCancelled() || found.solved || await isSolved()) return;
  if (found.audio) {
    await solveRecaptchaAudio(found.frame, { key, isCancelled, isSolved, onUpdate, post, wait });
    return;
  }
  if (found.frame) {
    await solveImageChallenge(page, found.frame, { key, isCancelled, isSolved, onUpdate, post, wait });
    return;
  }
  await tokenTask;
  if (!isCancelled() && !await isSolved()) throw new Error('Không thấy ảnh reCAPTCHA');
}

function collectCaptchaSnapshot(root = globalThis) {
  const queryParam = (url, name) => {
    try {
      return new URL(url, 'https://captcha.local').searchParams.get(name) || '';
    } catch {
      return '';
    }
  };
  const document = root.document;
  const href = root.location?.href || '';
  if (!document?.querySelectorAll) return { url: href, text: '' };
  const iframes = [...document.querySelectorAll('iframe')].map(element => element.src || '').filter(Boolean);
  const scriptText = [...document.querySelectorAll('script')].map(element => `${element.src || ''}\n${element.textContent || ''}`).join('\n');
  const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) || '';
  const recaptchaIframe = iframes.find(src => /recaptcha/i.test(src)) || '';
  const widget = document.querySelector('.g-recaptcha');
  const v3Match = scriptText.match(/recaptcha\/(?:api|enterprise)\.js\?render=([A-Za-z0-9_-]+)/);
  const v3 = v3Match && v3Match[1] !== 'explicit' ? v3Match[1] : '';
  const hIframe = iframes.find(src => /hcaptcha\.com/i.test(src)) || '';
  const turnstileIframe = iframes.find(src => /challenges\.cloudflare\.com|turnstile/i.test(src)) || '';
  const funIframe = iframes.find(src => /arkoselabs|funcaptcha/i.test(src)) || '';
  const image = document.querySelector('img[id*="captcha" i], img[class*="captcha" i], img[src*="captcha" i], img[alt*="captcha" i], svg[id*="captcha" i], svg[class*="captcha" i]');
  const captchaInputs = [...document.querySelectorAll('input, textarea')].filter(element => {
    const name = `${element.id || ''} ${element.getAttribute?.('name') || ''}`;
    return /captcha/i.test(name) && !/g-recaptcha-response|h-captcha-response|cf-turnstile-response/i.test(name);
  });
  const audio = document.querySelector('#audio-source, audio[src], audio source[src]');
  if (image?.setAttribute) image.setAttribute('data-inz-captcha-target', 'image');
  if (captchaInputs[0]?.setAttribute) captchaInputs[0].setAttribute('data-inz-captcha-target', 'input');
  const tag = String(image?.tagName || '').toLowerCase();
  const geetestPage = /geetest|initGeetest/i.test(scriptText);
  return {
    url: href,
    text: (document.body?.innerText || '').slice(0, 400),
    recaptcha: {
      sitekey: widget?.getAttribute('data-sitekey') || queryParam(recaptchaIframe, 'k') || v3,
      invisible: widget?.getAttribute('data-size') === 'invisible',
      version: widget || /\/recaptcha\/(?:api2|enterprise)\/(?:anchor|bframe)/i.test(recaptchaIframe) ? 'v2' : (v3 ? 'v3' : ''),
      action: widget?.getAttribute('data-action') || '',
      iframeSrc: recaptchaIframe,
      widgetId: widget?.id || ''
    },
    hcaptcha: {
      sitekey: attr('.h-captcha', 'data-sitekey') || queryParam(hIframe, 'sitekey'),
      iframeSrc: hIframe,
      callback: attr('.h-captcha', 'data-callback')
    },
    turnstile: {
      sitekey: attr('.cf-turnstile', 'data-sitekey') || queryParam(turnstileIframe, 'sitekey'),
      iframeSrc: turnstileIframe,
      callback: attr('.cf-turnstile', 'data-callback')
    },
    funcaptcha: {
      sitekey: attr('#FunCaptcha, [data-pkey]', 'data-pkey') || queryParam(funIframe, 'pk'),
      blob: attr('#FunCaptcha, [data-pkey]', 'data-blob') || queryParam(funIframe, 'data'),
      iframeSrc: funIframe,
      callback: attr('#FunCaptcha, [data-callback]', 'data-callback')
    },
    geetest4: {
      captchaId: geetestPage ? (attr('[data-captcha-id]', 'data-captcha-id') || (scriptText.match(/captcha[_-]?id['"\s:=]+['"]([a-f0-9]{16,})/i) || [])[1] || '') : ''
    },
    geetest: geetestPage ? {
      gt: (scriptText.match(/["']gt["']\s*:\s*["']([a-f0-9]{16,})/i) || [])[1] || '',
      challenge: (scriptText.match(/["']challenge["']\s*:\s*["']([a-f0-9]{16,})/i) || [])[1] || ''
    } : {},
    mtcaptcha: {
      sitekey: (scriptText.match(/MTPublic-[A-Za-z0-9]+/) || [])[0] || attr('[data-sitekey^="MTPublic"]', 'data-sitekey')
    },
    image: {
      src: tag === 'svg' ? '' : (image?.currentSrc || image?.getAttribute?.('src') || ''),
      svg: tag === 'svg' ? (image.outerHTML || '') : '',
      codes: captchaInputs.length > 1
    },
    audio: {
      src: audio?.src || audio?.getAttribute?.('src') || '',
      challenge: Boolean(document.querySelector('#audio-response, .rc-audiochallenge'))
    }
  };
}

function classifyCaptcha(snapshot = {}) {
  const url = snapshot.url || '';
  const base = {
    url,
    sitekey: '',
    widgetId: '',
    iframeSrc: '',
    invisible: false,
    action: '',
    blob: '',
    gt: '',
    challenge: '',
    captchaId: '',
    image: '',
    audio: '',
    callback: '',
    proxy: ''
  };
  const pack = (kind, extra) => ({ ...base, kind, type: kind, ...extra });
  if (snapshot.turnstile?.sitekey) return pack('turnstile', { sitekey: snapshot.turnstile.sitekey, iframeSrc: snapshot.turnstile.iframeSrc || '', callback: snapshot.turnstile.callback || '' });
  if (snapshot.hcaptcha?.sitekey) return pack('hcaptcha', { sitekey: snapshot.hcaptcha.sitekey, iframeSrc: snapshot.hcaptcha.iframeSrc || '', callback: snapshot.hcaptcha.callback || '' });
  if (snapshot.funcaptcha?.sitekey) return pack('funcaptcha', { sitekey: snapshot.funcaptcha.sitekey, iframeSrc: snapshot.funcaptcha.iframeSrc || '', blob: snapshot.funcaptcha.blob || '', callback: snapshot.funcaptcha.callback || '' });
  if (snapshot.geetest4?.captchaId) return pack('geetest_v4', { captchaId: snapshot.geetest4.captchaId, sitekey: snapshot.geetest4.captchaId });
  if (snapshot.geetest?.gt) return pack('geetest', { gt: snapshot.geetest.gt, challenge: snapshot.geetest.challenge || '', sitekey: snapshot.geetest.gt });
  if (snapshot.mtcaptcha?.sitekey) return pack('mtcaptcha', { sitekey: snapshot.mtcaptcha.sitekey });
  const recaptcha = snapshot.recaptcha || {};
  if (recaptcha.sitekey && recaptcha.version === 'v2') {
    return pack('recaptcha_v2', {
      type: 'recaptcha',
      sitekey: recaptcha.sitekey,
      widgetId: recaptcha.widgetId || '',
      iframeSrc: recaptcha.iframeSrc || '',
      invisible: Boolean(recaptcha.invisible),
      action: recaptcha.action || ''
    });
  }
  if (recaptcha.sitekey && recaptcha.version === 'v3') {
    return pack('recaptcha_v3', { type: 'recaptcha', sitekey: recaptcha.sitekey, action: recaptcha.action || '', iframeSrc: recaptcha.iframeSrc || '' });
  }
  if (snapshot.audio?.challenge || snapshot.audio?.src) return pack('speech', { audio: snapshot.audio.src || '', iframeSrc: recaptcha.iframeSrc || '' });
  const image = snapshot.image || {};
  if (image.src || image.svg) return pack(image.codes ? 'getcode' : 'imagetotext', { image: image.svg || image.src || '' });
  return { ...base, kind: '', type: 'captcha', sitekey: recaptcha.sitekey || '' };
}

function injectCaptchaAnswer(kind, answer, root = globalThis) {
  const document = root.document;
  if (!document?.querySelector) return;
  const pokeField = (element, value) => {
    if (!element) return;
    element.value = value;
    element.setAttribute?.('data-inz-captcha-answer', '1');
    if (typeof element.dispatchEvent !== 'function' || typeof Event !== 'function') return;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const callNamedCallback = (name, payload) => {
    const fn = name ? root[name] : null;
    if (typeof fn !== 'function') return;
    try { fn(payload); } catch { /* callback của widget có thể chạm frame khác origin */ }
  };
  const set = (selector, value) => {
    for (const element of document.querySelectorAll(selector)) pokeField(element, value);
  };
  if (kind === 'hcaptcha') {
    const token = String(answer || '');
    set('textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"]', token);
    callNamedCallback(document.querySelector('.h-captcha')?.getAttribute('data-callback'), token);
    return;
  }
  if (kind === 'turnstile') {
    const token = answer && typeof answer === 'object' ? (answer.token || '') : String(answer || '');
    if (answer && typeof answer === 'object' && answer.clearance) document.cookie = `cf_clearance=${answer.clearance}; path=/`;
    set('[name="cf-turnstile-response"]', token);
    callNamedCallback(document.querySelector('.cf-turnstile')?.getAttribute('data-callback'), token);
    return;
  }
  if (kind === 'funcaptcha') {
    const token = String(answer || '');
    set('#FunCaptcha-Token, input[name="fc-token"], input[name="verification-token"]', token);
    callNamedCallback(document.querySelector('#FunCaptcha, [data-callback]')?.getAttribute('data-callback'), token);
    return;
  }
  if (kind === 'mtcaptcha') {
    set('[name="mtcaptcha-verifiedtoken"]', String(answer || ''));
    return;
  }
  if (kind === 'geetest_v4' && answer && typeof answer === 'object') {
    for (const name of ['lot_number', 'pass_token', 'gen_time', 'captcha_output', 'captcha_id']) set(`[name="${name}"]`, answer[name] || '');
    return;
  }
  if (kind === 'geetest') {
    if (answer && typeof answer === 'object') {
      set('[name="geetest_challenge"]', answer.challenge || '');
      set('[name="geetest_validate"]', answer.validate || '');
      set('[name="geetest_seccode"]', answer.seccode || '');
      return;
    }
    set('[name="geetest_validate"], [name="geetest_seccode"]', String(answer || ''));
    return;
  }
  if (kind === 'getcode') {
    const codes = String(answer || '').split(',').map(item => item.trim()).filter(Boolean);
    const inputs = [...document.querySelectorAll('[data-inz-captcha-target="input"], input[name*="captcha" i], input[id*="captcha" i]')];
    inputs.forEach((input, index) => pokeField(input, codes[index] || ''));
    return;
  }
  if (kind === 'imagetotext' || kind === 'speech') {
    const input = document.querySelector('[data-inz-captcha-target="input"], #audio-response, input[name*="captcha" i], input[id*="captcha" i]');
    pokeField(input, String(answer || ''));
  }
}

async function screenshotTarget(page, selector) {
  const handle = await page.$(selector);
  if (!handle) throw new Error('Không thấy ảnh captcha');
  const shot = await handle.screenshot({ encoding: 'base64' });
  return Buffer.isBuffer(shot) ? shot.toString('base64') : String(shot);
}

async function solveTokenCaptcha({ page, info, apiKey, source = 'whitelist', isCancelled = () => false, isSolved = async () => false, onUpdate = () => {}, post = postProcess, wait = (ms => new Promise(resolve => setTimeout(resolve, ms))) }) {
  const key = String(apiKey || '').trim();
  if (!key) {
    onUpdate('skip', { reason: 'missing_api_key' });
    return;
  }
  onUpdate('key', { source, key });
  const needsSitekey = ['hcaptcha', 'turnstile', 'funcaptcha', 'mtcaptcha', 'recaptcha_v3'];
  if (needsSitekey.includes(info.kind) && !info.sitekey) throw new Error(`Không thấy site key của ${info.kind}`);
  if (info.kind === 'geetest_v4' && !info.captchaId) throw new Error('Không thấy captchaId của GeeTest');
  if (info.kind === 'geetest' && !info.gt) throw new Error('Không thấy gt của GeeTest');
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (isCancelled() || await isSolved()) return;
    try {
      const payload = captchaRequestBody(key, info);
      onUpdate('request', { type: payload.type, attempt: attempt + 1 });
      const solved = await post({
        payload,
        timeoutMs: CAPTCHA_SLOW_MS,
        timeoutMessage: `Autocaptcha hết thời gian chờ ${info.kind}`
      });
      if (isCancelled() || await isSolved()) return;
      const answer = solved.captcha;
      const ready = typeof answer === 'string'
        ? answer.trim().length > 0
        : Boolean(answer && typeof answer === 'object' && (answer.token || answer.pass_token || answer.validate || answer.captcha_output));
      if (!ready) throw new Error('Autocaptcha không trả kết quả');
      if (info.kind === 'recaptcha_v3') await page.evaluate(injectRecaptchaToken, String(answer));
      else await page.evaluate(injectCaptchaAnswer, info.kind, answer);
      onUpdate('token', { kind: info.kind, length: typeof answer === 'string' ? answer.length : JSON.stringify(answer).length });
      await wait(400);
      return;
    } catch (error) {
      lastError = error;
      if (isCancelled()) return;
      onUpdate('retry', { attempt: attempt + 1, message: error.message });
      await wait(800);
    }
  }
  throw lastError;
}

async function solveDirectCaptcha({ page, info, apiKey, source = 'whitelist', isCancelled = () => false, isSolved = async () => false, onUpdate = () => {}, post = postProcess, wait = (ms => new Promise(resolve => setTimeout(resolve, ms))) }) {
  const key = String(apiKey || '').trim();
  if (!key) {
    onUpdate('skip', { reason: 'missing_api_key' });
    return;
  }
  onUpdate('key', { source, key });
  const next = { ...info };
  if (info.kind === 'speech') {
    if (!info.audio) throw new Error('Không thấy file audio của captcha');
    next.audio = /^[A-Za-z0-9+/=]+$/.test(info.audio) && info.audio.length > 80
      ? info.audio
      : await page.evaluate(readAudioBase64, info.audio);
  } else if (!next.image || next.image.startsWith('blob:')) {
    next.image = await screenshotTarget(page, '[data-inz-captcha-target="image"]');
  }
  if (isCancelled() || await isSolved()) return;
  const payload = captchaRequestBody(key, next);
  onUpdate('request', { type: payload.type });
  const solved = await post({
    payload,
    timeoutMs: CAPTCHA_SLOW_MS,
    timeoutMessage: `Autocaptcha hết thời gian chờ ${info.kind}`
  });
  if (isCancelled()) return;
  const answer = String(solved.captcha || solved.text || '').trim();
  if (!answer) throw new Error('Autocaptcha không trả kết quả');
  if (info.kind === 'funcaptcha_image') {
    const index = Number(answer);
    if (!Number.isInteger(index)) throw new Error('Autocaptcha không trả vị trí ảnh FunCaptcha');
    const clicked = await page.evaluate(position => {
      const buttons = [...document.querySelectorAll('.answer-frame, .funcaptcha button, [class*="funcaptcha"] button')];
      const target = buttons[position];
      if (!target) return false;
      target.click();
      return true;
    }, index);
    onUpdate('funcaptcha_image', { index, clicked });
    await wait(300);
    return;
  }
  await page.evaluate(injectCaptchaAnswer, info.kind, answer);
  onUpdate(info.kind === 'speech' ? 'speech' : 'image_text', { length: answer.length });
  await wait(300);
}

async function solveCaptchaOnPage(options) {
  const kind = options.info?.kind || 'recaptcha_v2';
  if (kind === 'recaptcha_v2' || kind === 'recaptcha' || !options.info?.kind) return solveRecaptchaOnPage(options);
  if (kind === 'imagetotext' || kind === 'getcode' || kind === 'speech' || kind === 'funcaptcha_image') return solveDirectCaptcha(options);
  return solveTokenCaptcha(options);
}

module.exports = {
  PROCESS_URL,
  CAPTCHA_SLOW_MS,
  speechRequestBody,
  recaptchaV2RequestBody,
  recaptchaTokenPayload,
  recaptchaImageRequestBody,
  captchaRequestBody,
  formatAutocaptchaProxy,
  collectCaptchaSnapshot,
  classifyCaptcha,
  readCaptchaAnswer,
  parseTileAnswer,
  speechAnswer,
  injectRecaptchaToken,
  injectCaptchaAnswer,
  showCaptchaKey,
  transcribeSpeech,
  solveRecaptchaToken,
  solveRecaptchaOnPage,
  solveCaptchaOnPage
};

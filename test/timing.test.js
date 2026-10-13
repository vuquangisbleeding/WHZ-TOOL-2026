const test = require('node:test');
const assert = require('node:assert/strict');
const { watchClickedAction, waitForNextDocument, waitUntilDocumentReady } = require('../src/timing');

function createPage() {
  const listeners = new Map();
  const page = {
    href: 'https://example.test/start',
    readyState: 'complete',
    marker: 'start-page',
    destroyed: false,
    mainFrame() { return page; },
    url() { return page.href; },
    on(event, fn) {
      const list = listeners.get(event) || [];
      list.push(fn);
      listeners.set(event, list);
    },
    off(event, fn) {
      listeners.set(event, (listeners.get(event) || []).filter(item => item !== fn));
    },
    emit(event, payload) {
      for (const fn of [...(listeners.get(event) || [])]) fn(payload);
    },
    async evaluate(fn, ...args) {
      if (page.destroyed) throw new Error('Execution context was destroyed, most likely because of a navigation.');
      const source = Function.prototype.toString.call(fn);
      if (source.includes('location.href')) {
        const ready = page.readyState === 'interactive' || page.readyState === 'complete';
        if (args.length >= 2) return { href: page.href, ready, changed: page.href !== args[0] || page.marker !== args[1] };
        return { href: page.href, ready };
      }
      if (source.includes('readyState')) return page.readyState === 'interactive' || page.readyState === 'complete';
      if (source.includes('innerText')) return page.marker;
      throw new Error(`unexpected evaluate: ${source}`);
    },
    waitForNavigation({ signal } = {}) {
      return new Promise((resolve, reject) => {
        const onAbort = () => reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        if (signal?.aborted) return onAbort();
        signal?.addEventListener('abort', onAbort, { once: true });
        page.finishNavigationWait = () => resolve(null);
      });
    },
    navigationRequest() {
      return { isNavigationRequest: () => true, frame: () => page };
    },
    dataRequest(frame = page) {
      return { isNavigationRequest: () => false, resourceType: () => 'xhr', frame: () => frame };
    }
  };
  return page;
}

async function flush() {
  for (let step = 0; step < 20; step += 1) await Promise.resolve();
}

async function advance(t, milliseconds) {
  for (let spent = 0; spent < milliseconds; spent += 50) {
    t.mock.timers.tick(50);
    await flush();
  }
}

test('a slow navigation is still waited out after 10s and continues on the poll the new page is ready', async t => {
  t.mock.timers.enable(['setTimeout']);
  const page = createPage();
  let result;
  const pending = watchClickedAction(page, 'run', async () => {
    page.emit('request', page.navigationRequest());
  }).then(value => { result = value; });
  t.after(async () => {
    page.destroyed = false;
    page.href = 'https://example.test/cleanup';
    page.finishNavigationWait?.();
    await advance(t, 500);
    await pending;
  });
  await flush();
  await advance(t, 15000);
  assert.equal(result, undefined);
  page.href = 'https://example.test/next';
  await advance(t, 50);
  assert.equal(result, 'navigation');
});

test('a page that arrives 12s after the old document is destroyed is filled on that poll', async t => {
  t.mock.timers.enable(['setTimeout']);
  const page = createPage();
  let result;
  const pending = watchClickedAction(page, 'run', async () => {
    page.destroyed = true;
    throw new Error('Execution context was destroyed, most likely because of a navigation.');
  }).then(value => { result = value; });
  t.after(async () => {
    page.destroyed = false;
    page.finishNavigationWait?.();
    await advance(t, 500);
    await pending;
  });
  await flush();
  await advance(t, 12000);
  assert.equal(result, undefined);
  page.destroyed = false;
  page.readyState = 'complete';
  await advance(t, 50);
  assert.equal(result, 'navigation');
});

test('a click that does not navigate settles at the short idle window', async t => {
  t.mock.timers.enable(['setTimeout']);
  const page = createPage();
  let result;
  const pending = watchClickedAction(page, 'run', async () => {}).then(value => { result = value; });
  t.after(async () => {
    page.href = 'https://example.test/cleanup';
    page.finishNavigationWait?.();
    await advance(t, 2000);
    await pending;
  });
  await flush();
  await advance(t, 1450);
  assert.equal(result, undefined);
  await advance(t, 50);
  assert.equal(result, 'ui_timeout');
});

test('a same-page update is not held for the navigation timeout', async t => {
  t.mock.timers.enable(['setTimeout']);
  const page = createPage();
  let result;
  const pending = watchClickedAction(page, 'run', async () => {
    page.marker = 'updated-panel';
  }).then(value => { result = value; });
  t.after(async () => {
    page.finishNavigationWait?.();
    await advance(t, 2000);
    await pending;
  });
  await flush();
  assert.equal(result, 'ui');
});

test('a failed navigation request returns without sitting out 10s', async t => {
  t.mock.timers.enable(['setTimeout']);
  const page = createPage();
  let result;
  const pending = watchClickedAction(page, 'run', async () => {
    const request = page.navigationRequest();
    page.emit('request', request);
    page.emit('requestfailed', request);
  }).then(value => { result = value; });
  t.after(async () => {
    page.finishNavigationWait?.();
    await advance(t, 2000);
    await pending;
  });
  await flush();
  assert.equal(result, 'navigation_failed');
});

test('waiting for the next document ignores the old 10s cap', async t => {
  t.mock.timers.enable(['setTimeout']);
  const page = createPage();
  let result;
  const pending = waitForNextDocument(page, page.href).then(value => { result = value; });
  t.after(async () => {
    page.href = 'https://example.test/cleanup';
    page.finishNavigationWait?.();
    await advance(t, 500);
    await pending;
  });
  await flush();
  await advance(t, 15000);
  assert.equal(result, undefined);
  page.href = 'https://example.test/submitted';
  await advance(t, 50);
  assert.equal(result, true);
});

test('same-url navigation resolves when the document commits, after a 12s response', async t => {
  t.mock.timers.enable(['setTimeout']);
  const page = createPage();
  let result;
  const pending = watchClickedAction(page, 'run', async () => {
    page.emit('request', page.navigationRequest());
  }).then(value => { result = value; });
  t.after(async () => {
    page.destroyed = false;
    page.finishNavigationWait?.();
    await advance(t, 500);
    await pending;
  });
  await flush();
  await advance(t, 12000);
  assert.equal(result, undefined);
  page.emit('requestfinished', page.navigationRequest());
  page.finishNavigationWait();
  await flush();
  await advance(t, 50);
  assert.equal(result, 'navigation');
});

test('a main-frame xhr that stays in flight for 12s is not abandoned at 1.5s', async t => {
  t.mock.timers.enable(['setTimeout']);
  const page = createPage();
  const xhr = page.dataRequest();
  let result;
  const pending = watchClickedAction(page, 'run', async () => {
    page.emit('request', xhr);
  }).then(value => { result = value; });
  t.after(async () => {
    page.emit('requestfinished', xhr);
    page.marker = 'after-xhr';
    await advance(t, 500);
    await pending;
  });
  await flush();
  await advance(t, 12000);
  assert.equal(result, undefined);
  page.emit('requestfinished', xhr);
  page.marker = 'after-xhr';
  await flush();
  await advance(t, 50);
  assert.equal(result, 'ui');
});

test('an xhr inside another frame does not hold the click', async t => {
  t.mock.timers.enable(['setTimeout']);
  const page = createPage();
  const xhr = page.dataRequest({});
  let result;
  const pending = watchClickedAction(page, 'run', async () => {
    page.emit('request', xhr);
  }).then(value => { result = value; });
  await flush();
  await advance(t, 1500);
  assert.equal(result, 'ui_timeout');
  await pending;
});

test('waitUntilDocumentReady continues once the new page answers', async () => {
  let calls = 0;
  const page = {
    async evaluate() {
      calls += 1;
      if (calls === 1) throw new Error('Execution context was destroyed, most likely because of a navigation.');
      return true;
    }
  };
  const started = Date.now();
  assert.equal(await waitUntilDocumentReady(page), true);
  assert.ok(Date.now() - started < 1000);
  assert.equal(calls, 2);
});

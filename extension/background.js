import { buildIndex } from './dictionary.js';

const defaultTitle = 'Nối Từ Online — bật hoặc tắt';
const tabWork = new Map();
let words;

function isNoituUrl(value) {
  if (!value) return false;
  const url = new URL(value);
  return url.protocol === 'https:' && ['www.noitu.fun', 'noitu.fun'].includes(url.hostname);
}

async function loadWordGroups() {
  async function load(name) {
    const response = await fetch(chrome.runtime.getURL(`data/${name}.txt`));
    if (!response.ok) throw new Error(`Không đọc được ${name}.txt`);
    const text = await response.text();
    if (!text.trim()) throw new Error(`Danh sách ${name}.txt trống.`);
    return text;
  }

  const [wordChain, preferred, vntk, viet74k] = await Promise.all([
    load('nguoi_choi'), load('von_tu_may'), load('vntk-tu-ghep'), load('viet74k-tu-ghep'),
  ]);
  const all = buildIndex([wordChain, preferred, vntk, viet74k].join('\n'));
  const trusted = buildIndex([preferred, vntk].join('\n'));
  return [[...all], [...trusted.values()].flat()];
}

function setBadge(tabId, label, title) {
  return Promise.all([
    chrome.action.setBadgeText({ tabId, text: label }),
    chrome.action.setBadgeBackgroundColor({ tabId, color: label === 'ON' ? '#167450' : '#8b4e1d' }),
    chrome.action.setTitle({ tabId, title }),
  ]);
}

async function signal(tabId, operation, groups) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (command, dictionary) => globalThis.noituOnline?.[command](dictionary),
    args: [operation, groups ?? null],
  });
  return result?.result;
}

const stateKey = (tabId) => `autoplay-${tabId}`;

async function getState(tabId) {
  const key = stateKey(tabId);
  return (await chrome.storage.session.get(key))[key];
}

function runForTab(tabId, operation) {
  const previous = tabWork.get(tabId) ?? Promise.resolve();
  const next = previous.then(operation).catch((error) => console.error('Nối Từ Online', error));
  tabWork.set(tabId, next);
  void next.then(() => {
    if (tabWork.get(tabId) === next) tabWork.delete(tabId);
  });
}

async function startPlaying(tabId, state, restored = false) {
  const installed = await signal(tabId, 'running');
  if (installed) return;

  words ??= loadWordGroups().catch((error) => { words = undefined; throw error; });
  const groups = await words;
  if (installed == null) {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['online.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['online.js'] });
  }
  await signal(tabId, 'start', { groups, blocked: state.blocked, restored });
}

async function restorePlaying(tabId, state, restored) {
  try {
    await startPlaying(tabId, state, restored);
  } catch (error) {
    await setBadge(tabId, 'ON', 'Vẫn bật. Đang chờ tab Noitu.fun sẵn sàng.').catch(() => {});
    console.error('Nối Từ Online', error);
  }
}

async function disablePlaying(tabId, onNoitu) {
  await chrome.storage.session.remove(stateKey(tabId));
  if (onNoitu) await signal(tabId, 'stop').catch(() => {});
  await setBadge(tabId, '', defaultTitle);
}

chrome.action.onClicked.addListener((tab) => {
  const tabId = tab.id;
  if (tabId === undefined) return;
  runForTab(tabId, async () => {
    const onNoitu = isNoituUrl(tab.url);
    if (await getState(tabId)) return disablePlaying(tabId, onNoitu);
    if (!onNoitu) return setBadge(tabId, '!', 'Mở Noitu.fun để sử dụng tiện ích.');

    const state = { blocked: false };
    await chrome.storage.session.set({ [stateKey(tabId)]: state });
    await setBadge(tabId, 'ON', 'Đang bật tự động nối từ…');
    await restorePlaying(tabId, state, false);
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined || !isNoituUrl(sender.url)) return;
  switch (message?.type) {
    case 'noitu-online-user-stop':
      runForTab(tabId, () => disablePlaying(tabId, true));
      break;
    case 'noitu-online-blocked':
      runForTab(tabId, async () => {
        const state = await getState(tabId);
        if (state && !state.blocked) {
          await chrome.storage.session.set({ [stateKey(tabId)]: { blocked: true } });
        }
      });
      break;
    case 'noitu-online-status':
      runForTab(tabId, async () => {
        const state = await getState(tabId);
        await setBadge(tabId, state ? 'ON' : '', message.status || defaultTitle);
      });
      break;
  }
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status !== 'loading' && change.status !== 'complete') return;
  runForTab(tabId, async () => {
    const state = await getState(tabId);
    if (!state) {
      if (change.status === 'loading') await setBadge(tabId, '', defaultTitle);
      return;
    }
    if (change.status === 'loading') return setBadge(tabId, 'ON', 'Đang tải trang…');
    if (!isNoituUrl(tab.url)) return setBadge(tabId, 'ON', 'Vẫn bật. Đang chờ tab Noitu.fun.');
    await restorePlaying(tabId, state, true);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  runForTab(tabId, () => chrome.storage.session.remove(stateKey(tabId)));
});

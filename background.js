const tabCounts = new Map();
const badgeUpdateQueue = new Map();
let badgeUpdateTimer = null;

function isValidTabId(tabId) {
  return Number.isInteger(tabId) && tabId >= 0;
}

function setBadge(tabId, count) {
  if (!isValidTabId(tabId)) return;
  const text = count > 999 ? '999+' : String(count ?? 0);
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#2d2d2d' });
  chrome.action.setTitle({ tabId, title: `OPFS files: ${count ?? 0}` });
}

function clearBadge(tabId) {
  if (!isValidTabId(tabId)) return;
  chrome.action.setBadgeText({ tabId, text: '' });
}

function processBadgeUpdates() {
  for (const [tabId, count] of badgeUpdateQueue) {
    tabCounts.set(tabId, count);
    setBadge(tabId, count);
  }
  badgeUpdateQueue.clear();
  badgeUpdateTimer = null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'opfs:fileCount') {
    const tabId = typeof message.tabId === 'number' ? message.tabId : sender?.tab?.id;
    if (isValidTabId(tabId)) {
      const count = Number(message.count ?? 0);
      
      // 检查是否需要更新（避免重复更新相同值）
      const currentCount = tabCounts.get(tabId);
      if (currentCount !== count) {
        badgeUpdateQueue.set(tabId, count);
        
        // 防抖处理，避免频繁更新
        if (!badgeUpdateTimer) {
          badgeUpdateTimer = setTimeout(processBadgeUpdates, 100);
        }
      }
    }
    sendResponse({ ok: true });
    return;
  }

});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabCounts.delete(tabId);
  badgeUpdateQueue.delete(tabId);
});

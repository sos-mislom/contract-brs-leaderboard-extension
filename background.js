const MATCH_ORIGIN = "https://contract.tochka-urfu.tech/";

async function inject(tabId, url) {
  if (!url || !url.startsWith(MATCH_ORIGIN)) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["styles.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (error) {
    console.warn("Contract BRS injection failed", error);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") inject(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  inject(tabId, tab.url);
});

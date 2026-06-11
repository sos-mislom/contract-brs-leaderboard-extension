const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

function firstExisting(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate));
}

const chrome = firstExisting([
  process.env.CONTRACT_CHROME_PATH,
  path.join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")
]) || "chrome";
const extensionDir = __dirname;
const profile = process.env.CONTRACT_CHROME_PROFILE || path.join(process.env.LOCALAPPDATA || os.tmpdir(), "contract-brs-chrome-profile");
const port = 9224;
const token = process.env.CONTRACT_TOKEN || "";
const targetUrl = "https://contract.tochka-urfu.tech/achievements?tab=leaderboard";
const injectedPages = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTabs() {
  const response = await fetch(`http://127.0.0.1:${port}/json`);
  return response.json();
}

async function ensureChrome() {
  try {
    const tabs = await getTabs();
    if (tabs.some((tab) => tab.type === "page" && tab.url.startsWith("https://contract.tochka-urfu.tech/"))) return;
  } catch {}

  spawn(chrome, [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    targetUrl
  ], {
    detached: true,
    stdio: "ignore"
  }).unref();
}

async function openContractTab() {
  let tabs = [];
  for (let index = 0; index < 40; index += 1) {
    try {
      tabs = await getTabs();
      const page = tabs.find((tab) => tab.type === "page" && tab.url.startsWith("https://contract.tochka-urfu.tech/"));
      if (page) return page;
      await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(targetUrl)}`, { method: "PUT" }).catch(() => {});
    } catch {}
    await sleep(500);
  }
  throw new Error("Contract page not found");
}

async function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return {
    send(method, params = {}) {
      const requestId = ++id;
      ws.send(JSON.stringify({ id: requestId, method, params }));
      return new Promise((resolve) => pending.set(requestId, resolve));
    },
    close() {
      ws.close();
    }
  };
}

function shouldInject(url) {
  if (!url || !url.startsWith("https://contract.tochka-urfu.tech/")) return false;
  return url.includes("leaderboard") || url.includes("tab=leaderboard") || url.includes("/feed") || url.includes("feed") || url.includes("achievements");
}

async function injectInto(page) {
  const client = await connect(page);
  const css = fs.readFileSync(path.join(extensionDir, "styles.css"), "utf8");
  const js = fs.readFileSync(path.join(extensionDir, "content.js"), "utf8");

  await client.send("Runtime.enable");
  if (token) {
    await client.send("Runtime.evaluate", {
      expression: `localStorage.setItem('token', ${JSON.stringify(token)});`,
      returnByValue: true
    });
  }
  await sleep(2000);
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      let style = document.getElementById('contract-brs-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'contract-brs-style';
        document.documentElement.appendChild(style);
      }
      style.textContent = ${JSON.stringify(css)};
    })();`,
    returnByValue: true
  });
  await client.send("Runtime.evaluate", { expression: js, returnByValue: true });
  client.close();
  injectedPages.set(page.id, Date.now());
}

async function inject() {
  await ensureChrome();
  const page = await openContractTab();
  await injectInto(page);
}

async function watch() {
  await ensureChrome();
  await openContractTab();
  while (true) {
    try {
      const tabs = await getTabs();
      const pages = tabs.filter((tab) => tab.type === "page" && shouldInject(tab.url));
      for (const page of pages) {
        const lastInjected = injectedPages.get(page.id) || 0;
        if (Date.now() - lastInjected < 2500) continue;
        try {
          const client = await connect(page);
          await client.send("Runtime.enable");
          const present = await client.send("Runtime.evaluate", {
            expression: "Boolean(document.getElementById('contract-brs-panel'))",
            returnByValue: true
          });
          client.close();
          if (!present?.result?.result?.value) await injectInto(page);
        } catch (error) {
          console.warn("watch inject failed", error.message || error);
        }
      }
    } catch (error) {
      console.warn("watch loop failed", error.message || error);
    }
    await sleep(1500);
  }
}

watch().catch((error) => {
  console.error(error);
  process.exit(1);
});

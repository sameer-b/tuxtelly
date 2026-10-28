import { createServer } from "node:http";
import { openSync, closeSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { Builder, By, Key, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import { download } from "geckodriver";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".vtt": "text/vtt",
  ".json": "application/json",
};
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const file = path.startsWith("/fixture/")
    ? join(root, "tests/fixtures/service.html")
    : ["/sample.webm", "/captions.vtt"].includes(path)
      ? join(root, "tests/fixtures", path)
      : join(root, "apps/launcher/dist", path === "/" ? "index.html" : path);
  if (!file.startsWith(root + "/")) {
    response.writeHead(403);
    response.end();
    return;
  }
  try {
    const data = await readFile(file);
    response.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    // Support byte ranges so Firefox can seek the locally generated fixture video.
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]);
      const end = range[2]
        ? Math.min(Number(range[2]), data.length - 1)
        : data.length - 1;
      response.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${data.length}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
      });
      response.end(data.subarray(start, end + 1));
    } else {
      response.setHeader("Content-Length", data.length);
      response.end(request.method === "HEAD" ? undefined : data);
    }
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise((resolve) =>
  server.listen(Number(process.env.FIXTURE_PORT ?? 0), "127.0.0.1", resolve),
);
const origin = `http://127.0.0.1:${server.address().port}`;
const uuid = "e470655d-f1a5-418f-89e7-f616c879cb30";
const home = `moz-extension://${uuid}/home.html`;
const options = new firefox.Options();
if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
else if (process.platform === "darwin")
  options.setBinary("/Applications/Firefox.app/Contents/MacOS/firefox");
if (process.env.HEADED !== "1") options.addArguments("-headless");
options.setPreference(
  "extensions.webextensions.uuids",
  JSON.stringify({ "tuxtelly@sameer-b.github.io": uuid }),
);
options.setPreference("extensions.webextOptionalPermissionPrompts", false);
options.setPreference("media.autoplay.default", 0);
options.setPreference("media.autoplay.blocking_policy", 0);
const driverPath = process.env.SELENIUM_REMOTE_URL
  ? undefined
  : (process.env.GECKODRIVER_BINARY ?? (await download()));
await mkdir(join(root, "artifacts/profiles"), { recursive: true });
const driverLog = openSync(join(root, "artifacts/geckodriver.log"), "w");
let driver;
const results = [];
const check = (label) => {
  results.push(label);
  console.log(`PASS ${label}`);
};
async function verifyCredits(label) {
  await driver.findElement(By.css('[data-view="about"]')).click();
  await driver.wait(until.elementLocated(By.id("about-title")), 5000);
  assert.ok(
    (await driver.findElement(By.css("main")).getText()).includes(
      "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    ),
  );
  await driver.wait(
    () =>
      driver.executeScript(`
      const logo = document.querySelector('img[alt="TMDB"]');
      return logo?.complete && logo.naturalWidth > 0 &&
        (new URL(logo.src).origin === location.origin || logo.src.startsWith('data:image/'));
    `),
    5000,
    "TMDB logo must load from the bundled app",
  );
  if (label === "bundled")
    await writeFile(
      join(root, "artifacts/about.png"),
      await driver.takeScreenshot(),
      "base64",
    );
  await driver.findElement(By.css(".wordmark")).click();
  check(`${label} About & credits includes TMDB attribution and a local logo`);
}
try {
  const builder = new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(options);
  if (process.env.SELENIUM_REMOTE_URL)
    builder.usingServer(process.env.SELENIUM_REMOTE_URL);
  else
    builder.setFirefoxService(
      new firefox.ServiceBuilder(driverPath)
        .addArguments(
          "--allow-system-access",
          "--profile-root",
          join(root, "artifacts/profiles"),
        )
        .enableVerboseLogging()
        .setStdio(["ignore", driverLog, driverLog]),
    );
  driver = await builder.build();
  await driver.manage().window().setRect({ width: 1440, height: 1080 });
  await driver.installWebExtension(
    join(root, "apps/extension/.output/firefox-mv3"),
    { permanent: false },
  );
  await driver.get(home);
  await driver.wait(
    until.elementLocated(By.css('[data-service="youtube"]')),
    10000,
  );
  const homeHandle = await driver.getWindowHandle();
  const message = async (payload) =>
    driver.executeAsyncScript(
      `const payload=arguments[0],done=arguments[arguments.length-1];
       if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
         browser.runtime.sendMessage(payload).then(done,e=>done({ok:false,error:String(e)}));
       } else {
         const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
         const reply=e=>{if(e.source!==window||e.origin!==location.origin||e.data?.channel!=='tuxtelly:reply'||e.data?.protocol!==1||e.data?.id!==id)return;clearTimeout(timer);removeEventListener('message',reply);done(e.data.reply);};
         addEventListener('message',reply);
         const timer=setTimeout(()=>{removeEventListener('message',reply);done({ok:false,error:'Launcher bridge timed out'})},5000);
         postMessage({channel:'tuxtelly:request',protocol:1,id,message:payload},location.origin);
       }`,
      payload,
    );
  const launcherMessage = async (payload) => {
    const activeHandle = await driver.getWindowHandle();
    if (activeHandle !== homeHandle) await driver.switchTo().window(homeHandle);
    try {
      return await message(payload);
    } finally {
      if (activeHandle !== homeHandle)
        await driver.switchTo().window(activeHandle);
    }
  };
  const initial = await message({ type: "state" });
  assert.equal(initial.ok, true);
  check("extension loads and returns validated configuration");
  assert.equal(
    await driver
      .findElements(By.css(".setup-guide li"))
      .then((items) => items.length),
    3,
  );
  assert.ok(
    initial.data.config.services.some((service) => service.id === "prime"),
  );
  const extensionManifest = await driver.executeScript(
    "return browser.runtime.getManifest()",
  );
  assert.equal(
    extensionManifest.browser_specific_settings.gecko.update_url,
    "https://github.com/sameer-b/tuxtelly/releases/latest/download/updates.json",
  );
  check("Firefox extension points at its automatic update manifest");
  check("guided setup and built-in Prime Video service appear");
  await verifyCredits("bundled");
  const config = (await message({ type: "state" })).data.config;
  config.bindings.push({
    key: "]",
    action: "seekForward",
    alt: false,
    ctrl: false,
    meta: false,
    shift: false,
  });
  config.launcherUrl = origin + "/";
  config.services = ["one", "two"].map((id) => ({
    id,
    name: `Fixture ${id}`,
    url: `${origin}/fixture/${id}`,
    origins: [origin],
    adapter: "generic",
    color: "#5be5bc",
    enabled: true,
    backgroundAudio: false,
  }));
  assert.equal((await message({ type: "save", config })).ok, true);
  const invalid = structuredClone(config);
  invalid.services[0].url = "javascript:alert(1)";
  assert.equal((await message({ type: "save", config: invalid })).ok, false);
  check("unsafe configuration rejected");
  await driver.executeScript(
    `const button=document.createElement('button'); button.id='test-grant';button.textContent='Grant fixture access';button.onclick=()=>browser.permissions.request({origins:['http://127.0.0.1/*']}).then(granted=>button.dataset.granted=String(granted));document.body.append(button);`,
  );
  await driver.findElement(By.id("test-grant")).click();
  await driver.wait(
    async () =>
      (await driver
        .findElement(By.id("test-grant"))
        .getAttribute("data-granted")) === "true",
    10000,
  );
  check("optional host permissions granted through user gesture");
  await message({ type: "save", config });
  await driver.get(origin);
  await driver.wait(
    until.elementLocated(By.css(".connection .dot:not(.offline)")),
    10000,
  );
  check("trusted hosted launcher connects to extension");
  await verifyCredits("hosted");
  await mkdir(join(root, "artifacts"), { recursive: true });
  await writeFile(
    join(root, "artifacts/launcher.png"),
    await driver.takeScreenshot(),
    "base64",
  );
  await driver.findElement(By.css('[data-service="one"]')).click();
  await driver.wait(
    async () => (await driver.getAllWindowHandles()).length === 2,
    10000,
  );
  const oneHandle = (await driver.getAllWindowHandles()).find(
    (id) => id !== homeHandle,
  );
  await driver.switchTo().window(oneHandle);
  await driver.wait(until.elementLocated(By.id("card-one")), 10000);
  await driver.sleep(300);
  await driver.executeScript(
    "document.activeElement?.blur(); document.body.tabIndex=-1; document.body.focus()",
  );
  await driver.actions().sendKeys(Key.ARROW_RIGHT).perform();
  assert.equal(
    await driver.executeScript(
      "return document.activeElement === document.body",
    ),
    true,
  );
  check("service arrows pass through without TuxTelly changing focus");
  await driver.findElement(By.id("search")).sendKeys("f c m k");
  assert.equal(
    await driver.findElement(By.id("search")).getAttribute("value"),
    "f c m k",
  );
  assert.equal(
    await driver.executeScript("return document.fullscreenElement === null"),
    true,
  );
  check("typing does not trigger player shortcuts");
  await driver.findElement(By.id("play")).click();
  await driver.wait(
    async () =>
      await driver.executeScript(
        'return !document.querySelector("video").paused && document.querySelector("video").seekable.length > 0',
      ),
    10000,
  );
  // Arrow keys belong to the provider. Exercise the configured seek shortcut
  // while paused so elapsed playback cannot make this assertion pass.
  await driver.actions().sendKeys("k").perform();
  await driver.wait(
    () => driver.executeScript('return document.querySelector("video").paused'),
    5000,
  );
  const beforeSeek = await driver.executeScript(
    'return document.querySelector("video").currentTime',
  );
  await driver.actions().sendKeys("]").perform();
  await driver.wait(
    async () =>
      Math.abs(
        (await driver.executeScript(
          'return document.querySelector("video").currentTime',
        )) -
          beforeSeek -
          config.preferences.seekSeconds,
      ) < 0.25,
    5000,
    "Configured seek shortcut must advance the paused video by the configured interval",
  );
  check("configured seek shortcut controls actual video");
  await driver.actions().sendKeys("k").perform();
  await driver.actions().sendKeys("c").perform();
  assert.equal(
    await driver.executeScript(
      'return document.querySelector("video").textTracks[0].mode',
    ),
    "showing",
  );
  check("captions toggle");
  await driver.actions().sendKeys("f").perform();
  await driver.wait(
    async () =>
      driver.executeScript("return document.fullscreenElement !== null"),
    5000,
  );
  await driver.wait(
    async () =>
      driver.executeScript(`
        const video = document.querySelector('video');
        const rect = video.getBoundingClientRect();
        return document.fullscreenElement === video &&
          Math.abs(rect.x) <= 1 && Math.abs(rect.y) <= 1 &&
          Math.abs(rect.width - innerWidth) <= 1 &&
          Math.abs(rect.height - innerHeight) <= 1;
      `),
    5000,
    "Fallback fullscreen must expand the video to fill the viewport",
  );
  await driver.actions().sendKeys("f").perform();
  await driver.wait(
    async () =>
      driver.executeScript("return document.fullscreenElement === null"),
    5000,
  );
  assert.equal(
    await driver.executeScript(
      'return document.querySelector("video").getBoundingClientRect().width',
    ),
    560,
  );
  check(
    "fallback fullscreen fills the viewport and restores the video size on exit",
  );
  await driver.actions().sendKeys(Key.F8).perform();
  await driver.wait(
    until.elementLocated(By.css('[data-tuxtelly="switcher"]')),
    5000,
  );
  await driver
    .actions()
    .sendKeys(Key.ARROW_RIGHT, Key.ARROW_RIGHT, Key.ENTER)
    .perform();
  await driver.wait(
    async () => (await driver.getAllWindowHandles()).length === 3,
    10000,
  );
  assert.equal(
    await driver.executeScript('return document.querySelector("video").paused'),
    true,
  );
  check("switcher pauses previous service before changing tabs");
  const twoHandle = (await driver.getAllWindowHandles()).find(
    (id) => ![homeHandle, oneHandle].includes(id),
  );
  await driver.switchTo().window(twoHandle);
  await driver.wait(until.elementLocated(By.id("card-one")), 10000);
  assert.equal(
    (await launcherMessage({ type: "state" })).data.config.services[0].id,
    "two",
  );
  check("most recently opened service moves to the first Home position");
  await driver.switchTo().window(oneHandle);
  await driver.findElement(By.id("play")).click();
  await driver.wait(
    async () =>
      !(await driver.executeScript(
        'return document.querySelector("video").paused',
      )),
    5000,
  );
  await driver.switchTo().window(homeHandle);
  await driver.wait(
    async () =>
      await driver.executeScript(
        'return document.querySelector(".service-entry [data-service]")?.dataset.service === "two"',
      ),
    5000,
  );
  check("Home live-sorts services by recent use on return");
  await driver.wait(
    async () =>
      await driver.executeScript(
        'return document.activeElement?.dataset?.service === "one"',
      ),
    5000,
  );
  check("returning Home restores keyboard focus to the selected service");
  await driver.get(home);
  assert.equal((await message({ type: "open", serviceId: "two" })).ok, true);
  await driver.switchTo().window(oneHandle);
  await driver.wait(
    async () =>
      await driver.executeScript(
        'return document.querySelector("video").paused',
      ),
    5000,
  );
  check("switching from Home pauses playback in an inactive service tab");

  await driver.executeScript('document.querySelector("video").remove()');
  await driver.switchTo().window(homeHandle);
  assert.equal((await message({ type: "open", serviceId: "two" })).ok, true);
  const mutedState = async () =>
    driver.executeAsyncScript(
      "const done=arguments[arguments.length-1];browser.tabs.query({}).then(tabs=>done(tabs.find(tab=>tab.url===arguments[0])?.mutedInfo?.muted));",
      `${origin}/fixture/one`,
    );
  await driver.wait(async () => await mutedState(), 5000);
  await driver.switchTo().window(oneHandle);
  await driver.executeScript(
    'const video=document.createElement("video");video.controls=true;video.style.cssText="display:block;width:560px";video.src="/sample.webm";document.body.append(video)',
  );
  await driver.switchTo().window(homeHandle);
  assert.equal((await message({ type: "open", serviceId: "one" })).ok, true);
  await driver.wait(async () => (await mutedState()) === false, 5000);
  check("extension-owned fallback mute is cleared when returning to a service");

  await driver.switchTo().window(oneHandle);
  await driver.executeScript('document.querySelector("video").remove()');
  await driver.switchTo().window(homeHandle);
  assert.equal((await message({ type: "open", serviceId: "two" })).ok, true);
  await driver.wait(async () => await mutedState(), 5000);
  const withoutOne = structuredClone(config);
  withoutOne.services = withoutOne.services.filter(
    (service) => service.id !== "one",
  );
  assert.equal((await message({ type: "save", config: withoutOne })).ok, true);
  await driver.wait(async () => (await mutedState()) === false, 5000);
  assert.equal((await message({ type: "save", config })).ok, true);
  check("removing a service clears TuxTelly-owned tab mute state");

  await driver.get(home);
  const rapid = await driver.executeAsyncScript(
    'const done=arguments[arguments.length-1];Promise.all(Array.from({length:12},()=>browser.runtime.sendMessage({type:"open",serviceId:"one"}))).then(done);',
  );
  assert.ok(rapid.every((reply) => reply.ok));
  assert.equal((await driver.getAllWindowHandles()).length, 3);
  check("rapid launch requests reuse one service tab");
  await driver.switchTo().window(twoHandle);
  await driver.close();
  await driver.switchTo().window(homeHandle);
  assert.equal((await message({ type: "open", serviceId: "two" })).ok, true);
  assert.equal((await driver.getAllWindowHandles()).length, 3);
  check("closed service tab recreated");
  await driver.switchTo().window(homeHandle);
  await driver.get(origin + "/fixture/unmanaged");
  const spoof = await driver.executeAsyncScript(
    `const done=arguments[arguments.length-1];const listener=e=>{if(e.data?.channel==='tuxtelly:reply' && e.data?.id==='attack'){window.removeEventListener('message',listener);done(true)}};window.addEventListener('message',listener);window.postMessage({channel:'tuxtelly:request',protocol:1,id:'attack',message:{type:'open',serviceId:'one'}},location.origin);setTimeout(()=>{window.removeEventListener('message',listener);done(false)},500);`,
  );
  assert.equal(spoof, false);
  check("unmanaged page on launcher origin cannot invoke bridge");
  await driver.get(home);
  await driver.executeAsyncScript(
    "const done=arguments[arguments.length-1];browser.permissions.remove({origins:['http://127.0.0.1/*']}).then(done);",
  );
  await driver.switchTo().window(oneHandle);
  await driver.sleep(500);
  await driver.actions().sendKeys(Key.F8).perform();
  assert.equal(
    await driver.executeScript(
      "return document.querySelector('[data-tuxtelly=\"switcher\"]') === null",
    ),
    true,
  );
  check("revoking site access removes controls from existing service tabs");
  await driver.switchTo().window(homeHandle);
  await driver.executeScript(
    `const button=document.createElement('button');button.id='test-regrant';button.textContent='Restore fixture access';button.onclick=()=>browser.permissions.request({origins:['http://127.0.0.1/*']}).then(granted=>button.dataset.granted=String(granted));document.body.append(button);`,
  );
  await driver.findElement(By.id("test-regrant")).click();
  await driver.wait(
    async () =>
      (await driver
        .findElement(By.id("test-regrant"))
        .getAttribute("data-granted")) === "true",
    5000,
  );
  const status = await message({ type: "state" });
  assert.deepEqual(
    status.data.config.services.map((service) => service.id).sort(),
    ["one", "two"],
  );
  await new Promise((resolve) => server.close(resolve));
  // Start on a service so a pre-existing Home tab cannot make this pass by itself.
  await message({ type: "open", serviceId: "one" });
  assert.equal((await message({ type: "home" })).ok, true);
  const activeUrl = await driver.executeAsyncScript(
    "const done=arguments[arguments.length-1];browser.tabs.query({active:true,currentWindow:true}).then(tabs=>done(tabs[0].url));",
  );
  assert.ok(activeUrl.startsWith(home));
  check("bundled Home remains available when hosting is offline");
  await writeFile(
    join(root, "artifacts/firefox-results.json"),
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        browser: (await driver.getCapabilities()).get("browserVersion"),
        platform: (await driver.getCapabilities()).get("platformName"),
        runnerPlatform: process.platform,
        results,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (driver) {
    try {
      await mkdir(join(root, "artifacts"), { recursive: true });
      await writeFile(
        join(root, "artifacts/firefox-failure.png"),
        await driver.takeScreenshot(),
        "base64",
      );
    } catch {
      // A closed browser cannot provide a screenshot; preserve the test failure.
    }
  }
  throw error;
} finally {
  if (driver) await driver.quit();
  server.close();
  closeSync(driverLog);
}

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
      "const done=arguments[arguments.length-1]; browser.runtime.sendMessage(arguments[0]).then(done,e=>done({ok:false,error:String(e)}));",
      payload,
    );
  const initial = await message({ type: "state" });
  assert.equal(initial.ok, true);
  check("extension loads and returns validated configuration");
  assert.equal(
    await driver
      .findElements(By.css(".setup-guide li"))
      .then((items) => items.length),
    3,
  );
  await driver.findElement(By.css('[aria-label="Pin Disney+"]')).click();
  await driver.wait(async () => {
    const state = await message({ type: "state" });
    return state.data.config.services.find((service) => service.id === "disney")
      .favorite;
  }, 5000);
  assert.equal(
    await driver.executeScript(
      'return document.querySelector(".service-entry [data-service]").dataset.service',
    ),
    "disney",
  );
  check("guided setup appears and pinned services move to the top");
  const config = (await message({ type: "state" })).data.config;
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
  await driver.findElement(By.css("body")).sendKeys(Key.ARROW_RIGHT);
  assert.equal(
    await driver.executeScript("return document.activeElement.id"),
    "card-one",
  );
  await driver.actions().sendKeys(Key.ARROW_RIGHT).perform();
  assert.equal(
    await driver.executeScript("return document.activeElement.id"),
    "card-two",
  );
  check("spatial navigation moves across service controls");
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
  await driver.actions().sendKeys(Key.ARROW_RIGHT).perform();
  assert.ok(
    (await driver.executeScript(
      'return document.querySelector("video").currentTime',
    )) >= 9,
  );
  check("seek action controls actual video");
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
  await driver.actions().sendKeys("f").perform();
  await driver.wait(
    async () =>
      driver.executeScript("return document.fullscreenElement === null"),
    5000,
  );
  check("player fullscreen enters and exits from keyboard input");
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
  await driver.switchTo().window(homeHandle);
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
  assert.equal(status.data.config.services[0].id, "one");
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
    await mkdir(join(root, "artifacts"), { recursive: true });
    await writeFile(
      join(root, "artifacts/firefox-failure.png"),
      await driver.takeScreenshot(),
      "base64",
    );
  }
  throw error;
} finally {
  if (driver) await driver.quit();
  server.close();
  closeSync(driverLog);
}

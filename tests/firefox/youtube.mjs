// Opt-in live-site probe. Never uses a personal Firefox profile or stored logins.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Builder, By, Key, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import { download } from "geckodriver";

const videoUrl =
  process.env.YOUTUBE_TEST_URL ?? "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
assert.equal(new URL(videoUrl).origin, "https://www.youtube.com");
const uuid = "e470655d-f1a5-418f-89e7-f616c879cb30";
const home = `moz-extension://${uuid}/home.html`;
const options = new firefox.Options();
if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
if (process.env.HEADED !== "1") options.addArguments("-headless");
options.setPreference(
  "extensions.webextensions.uuids",
  JSON.stringify({ "tuxtelly@sameer-b.github.io": uuid }),
);
options.setPreference("extensions.webextOptionalPermissionPrompts", false);
const builder = new Builder().forBrowser("firefox").setFirefoxOptions(options);
await mkdir("artifacts/profiles", { recursive: true });
if (process.env.SELENIUM_REMOTE_URL)
  builder.usingServer(process.env.SELENIUM_REMOTE_URL);
else
  builder.setFirefoxService(
    new firefox.ServiceBuilder(
      process.env.GECKODRIVER_BINARY ?? (await download()),
    ).addArguments(
      "--allow-system-access",
      "--profile-root",
      resolve("artifacts/profiles"),
    ),
  );
const driver = await builder.build();
const results = [];
const check = (label) => {
  results.push(label);
  console.log(`PASS ${label}`);
};
const media = () =>
  driver.executeScript(
    "const v=document.querySelector('video'); return v && {time:v.currentTime,paused:v.paused,volume:v.volume,muted:v.muted,ready:v.readyState};",
  );
const blur = () => driver.executeScript("document.activeElement?.blur()");
try {
  await driver.manage().setTimeouts({ pageLoad: 45000, script: 15000 });
  await driver.manage().window().setRect({ width: 1440, height: 1080 });
  // Establish ordinary Firefox playback before adding the extension.
  await driver.get(videoUrl);
  await driver.wait(until.elementLocated(By.css(".ytp-play-button")), 20000);
  await driver.wait(async () => (await media())?.ready >= 2, 20000);
  if ((await media()).paused)
    await driver.findElement(By.css(".ytp-play-button")).click();
  await driver.wait(async () => (await media())?.time > 1, 15000);
  check("ordinary signed-out Firefox plays the public YouTube test video");
  await driver.executeScript("document.querySelector('video').pause()");

  await driver.installWebExtension(
    resolve("apps/extension/.output/firefox-mv3"),
    { permanent: false },
  );
  await driver.get(home);
  await driver.wait(
    until.elementLocated(By.css('[data-service="youtube"]')),
    10000,
  );
  const homeHandle = await driver.getWindowHandle();
  assert.equal(
    await driver.executeAsyncScript(
      "const done=arguments[0];browser.permissions.contains({origins:['https://www.youtube.com/*']}).then(done)",
    ),
    false,
  );
  await driver.findElement(By.css('[data-service="youtube"]')).click();
  await driver.wait(
    async () => (await driver.getAllWindowHandles()).length === 2,
    10000,
  );
  check("first YouTube launch requests permission and opens the service");
  const serviceHandle = (await driver.getAllWindowHandles()).find(
    (h) => h !== homeHandle,
  );
  await driver.switchTo().window(serviceHandle);
  await driver.wait(
    until.elementLocated(By.css('input[name="search_query"]')),
    20000,
  );
  const search = await driver.findElement(By.css('input[name="search_query"]'));
  await search.sendKeys("Big Buck Bunny Blender", Key.ENTER);
  await driver.wait(until.urlContains("/results?search_query="), 15000);
  await driver.wait(
    until.elementLocated(By.css('a[href^="/watch?v="]')),
    15000,
  );
  check("YouTube search accepts keyboard text and Enter");
  check("YouTube search and catalog remain usable with provider controls");
  await driver.get(videoUrl);
  await driver.wait(async () => (await media())?.ready >= 2, 20000);
  await blur();
  if ((await media()).paused) await driver.actions().sendKeys("k").perform();
  await driver.wait(
    async () => !(await media()).paused && (await media()).time > 1,
    15000,
  );
  await driver.actions().sendKeys("k").perform();
  assert.equal((await media()).paused, true);
  await driver.actions().sendKeys("k").perform();
  assert.equal((await media()).paused, false);
  check("YouTube play/pause works from keyboard input");
  assert.equal(
    await driver.executeScript(
      "const e=new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true});document.dispatchEvent(e);return e.defaultPrevented",
    ),
    false,
  );
  check("TuxTelly leaves provider arrow keys untouched");
  await driver.actions().sendKeys("-").perform();
  const lowerVolume = (await media()).volume;
  await driver.actions().sendKeys("+").perform();
  assert.ok((await media()).volume > lowerVolume);
  const muted = (await media()).muted;
  await driver.actions().sendKeys("m").perform();
  assert.equal((await media()).muted, !muted);
  await driver.actions().sendKeys("m").perform();
  check("YouTube volume and mute work from keyboard input");
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
  check("YouTube player fullscreen enters and exits");
  const captions = await driver.findElements(
    By.css(
      '.ytp-subtitles-button:not([disabled]):not([aria-disabled="true"]):not([aria-label*="unavailable" i])',
    ),
  );
  let captionsResult =
    "No available captions control on the test video; not tested";
  if (captions.length && (await captions[0].isDisplayed())) {
    const before = await captions[0].getAttribute("aria-pressed");
    await blur();
    await driver.actions().sendKeys("c").perform();
    await driver.wait(
      async () => (await captions[0].getAttribute("aria-pressed")) !== before,
      5000,
    );
    captionsResult = "Keyboard captions toggle changed the player control";
    check(captionsResult);
  }
  await blur();
  await driver.actions().sendKeys(Key.F8).perform();
  await driver.wait(
    until.elementLocated(By.css('[data-tuxtelly="switcher"]')),
    5000,
  );
  await driver.actions().sendKeys(Key.ENTER).perform();
  await driver.wait(async () => (await media()).paused, 5000);
  check("switching Home pauses YouTube playback");
  await driver.switchTo().window(homeHandle);
  await driver.findElement(By.css('[data-service="youtube"]')).click();
  assert.equal((await driver.getAllWindowHandles()).length, 2);
  await driver.switchTo().window(serviceHandle);
  assert.ok((await driver.getCurrentUrl()).startsWith(videoUrl));
  check("returning to YouTube preserves its existing watch tab");
  await writeFile(
    "artifacts/youtube-results.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        browser: (await driver.getCapabilities()).get("browserVersion"),
        platform: (await driver.getCapabilities()).get("platformName"),
        videoUrl,
        signedIn: false,
        results,
        captions: captionsResult,
        limits:
          "Headless public-video probe; account profiles, ads, TV/remote, localization and DRM are not qualified.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    "artifacts/youtube-failure.png",
    await driver.takeScreenshot(),
    "base64",
  );
  throw error;
} finally {
  await driver.quit();
}

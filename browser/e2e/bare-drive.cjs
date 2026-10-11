// The core mounted by a flavor that adds nothing (bare/): no tools, artifact kinds or session
// store of its own, launched on the current history. Every other drive mounts Olit, so this is
// the one that fails when the core starts depending on something only Olit provides.
const { chromium } = require("playwright");

const APP = process.env.BARE_URL || "http://localhost:5174/";
const STUB = process.env.STUB_URL || "http://127.0.0.1:8099";

let failed = 0;
const check = (name, ok, detail) => {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -- " + detail : ""}`);
};

(async () => {
    await fetch(`${STUB}/__script?name=plain`);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
    const logs = [];
    page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

    const wait = async (fn, ms) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await page.evaluate(fn)) return true;
            await page.waitForTimeout(400);
        }
        return false;
    };

    await page.goto(APP, { waitUntil: "domcontentloaded" });
    const booted = await wait(() => /\bready\b/i.test(document.body.innerText), 120000);
    check("booted on the current history", booted);
    if (!booted) {
        console.log((await page.evaluate(() => document.body.innerText)).slice(-600));
        console.log(logs.slice(-10).join("\n"));
        await browser.close();
        process.exit(1);
    }

    check("no Save button without a session store",
          !(await page.locator("#save-btn").isVisible().catch(() => false)));

    await page.fill("#input", "hello");
    await page.click("#send-btn");
    check("a turn is answered", await wait(() => document.body.innerText.includes("Noted."), 60000));

    const body = await page.evaluate(() => document.body.innerText);
    check("nothing on screen points at a Save it doesn't have", !/\bSave\b/.test(body),
          (body.match(/.{0,60}\bSave\b.{0,60}/) || [""])[0]);
    check("no page errors", !logs.some((l) => l.startsWith("[pageerror]")),
          logs.filter((l) => l.startsWith("[pageerror]")).join("; "));

    await browser.close();
    console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
    process.exit(failed ? 1 : 0);
})();

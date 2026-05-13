require("dotenv").config();
const express = require("express");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const bodyParser = require("body-parser");
const barcodeScraper = require("./scrapers/barcodeScraper");
const { ensureOutputDir } = require("./scripts/datasFs");

puppeteer.use(StealthPlugin());
ensureOutputDir();

const PORT = 3000;
const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/get-products", async (req, res) => {
    const barcodeList = req.body.barcodes;
    if (!Array.isArray(barcodeList) || barcodeList.length === 0) {
        return res.status(400).json({ error: "Barkod listesi eksik." });
    }
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-sync",
                "--disable-translate",
                "--mute-audio",
                "--no-first-run",
                "--hide-scrollbars",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
            ],
        });
        const results = await barcodeScraper.fetchBarcodes(barcodeList, browser);
        await browser.close();
        res.json(results);
    } catch (err) {
        console.error("Hata:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/search", async (req, res) => {
    const barcodeList = req.body.barcodes;
    if (!Array.isArray(barcodeList) || barcodeList.length === 0) {
        return res.status(400).json({ error: "Barkod listesi eksik." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-sync",
                "--disable-translate",
                "--mute-audio",
                "--no-first-run",
                "--hide-scrollbars",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
            ],
        });
        await barcodeScraper.fetchBarcodes(barcodeList, browser, (result) => {
            send({ type: "result", ...result });
        });
        await browser.close();
        browser = null;
    } catch (err) {
        console.error("SSE hatasi:", err.message);
        send({ type: "error", message: err.message });
    } finally {
        if (browser) await browser.close().catch(() => {});
        send({ type: "complete" });
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} uzerinde calisiyor.`);
});

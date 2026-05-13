require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const barcodeScraper = require("./scrapers/barcodeScraper");
const { ensureOutputDir } = require("./scripts/datasFs");

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
        const results = await barcodeScraper.fetchBarcodes(barcodeList);
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

    try {
        await barcodeScraper.fetchBarcodes(barcodeList, (result) => {
            send({ type: "result", ...result });
        });
    } catch (err) {
        console.error("SSE hatasi:", err.message);
        send({ type: "error", message: err.message });
    } finally {
        send({ type: "complete" });
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} uzerinde calisiyor.`);
});

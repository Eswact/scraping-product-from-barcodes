const express = require("express");
const puppeteer = require("puppeteer");
const bodyParser = require("body-parser");
const barcodeScraper = require("./scrapers/barcodeScraper");
const PORT = 3000;

const app = express();
app.use(bodyParser.json(({limit: '50mb'})));
app.use(bodyParser.urlencoded({limit: '50mb'}));

app.post("/get-barcodes", async (req, res) => {
  const barcodeList = req.body.barcodes;

  if (!Array.isArray(barcodeList) || barcodeList.length === 0) {
      return res.status(400).json({ error: "Barkod listesi eksik veya geçersiz." });
  }

  try {
      const browser = await puppeteer.launch({
          headless: true,
          args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
          ],
      });

      const results = await barcodeScraper.fetchBarcodes(barcodeList, browser);

      await browser.close();

      res.json(results);
  } catch (err) {
      console.error("❌ Genel hata:", err.message);
      res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} üzerinde çalışıyor.`);
});

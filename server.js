const express = require("express");
const barcodeScraper = require("./scrapers/barcodeScraper");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.post("/get-barcode", async (req, res) => {
    const barcode = req.body.barcode;
    
    if (!barcode) {
        return res.status(400).json({ error: "Barkod numarası eksik." });
    }

    const barcodes = await barcodeScraper.fetchBarcode(barcode);
    res.json(barcodes);
});

app.post("/get-barcodes", async (req, res) => {
  const barcodeList = req.body.barcodes;

  if (!Array.isArray(barcodeList) || barcodeList.length === 0) {
      return res.status(400).json({ error: "Barkod listesi eksik veya geçersiz." });
  }

  let results = [];
  let lastMarket= null

  for (let i = 0; i < barcodeList.length; i++) {
      const barcode = barcodeList[i];
      console.log(`🔍 [${i + 1}/${barcodeList.length}] ${barcode} aranıyor...`);
      try {
          const result = await barcodeScraper.fetchBarcode(barcode, lastMarket);
          results.push({ barcode, ...result });

          if (result.site) {
            lastMarket = result.site;
          } else {
            lastMarket = null;
          }
      } catch (err) {
          console.warn(`❌ ${barcode} işlenemedi: ${err.message}`);
          results.push({ barcode, success: false, message: err.message });
      }

      if (i == barcodeList.length - 1) {
        console.log("✅ Tüm aramalar tamamlandı.");
      }
  }

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} üzerinde çalışıyor.`);
});

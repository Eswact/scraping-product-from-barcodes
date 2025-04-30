const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../datas/csv/kapasitetoptan.csv");

fs.readFile(filePath, "utf8", (err, data) => {
  if (err) {
    return console.error("Dosya okunamadı:", err);
  }

  const lines = data.split("\n");
  const barcodes = [];

  for (const line of lines) {
    const parts = line.trim().split(";");

    if (parts.length >= 2) {
      const barcode = parts[1].trim();

      if (/^\d{13}$/.test(barcode)) {
        barcodes.push(barcode);
      }
    }
  }

  console.log("✅ Barkodlar:", barcodes);

  fs.writeFileSync("datas/json/extracted-barcodes.json", JSON.stringify(barcodes, null, 2));
  console.log("📁 'extracted-barcodes.json' dosyasına yazıldı.");
});

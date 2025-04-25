const fs = require("fs");
const path = require("path");

const CSV_PATH = "./datas/csv/bufiyat_stoklar.csv";
const JSON_PATH = "./datas/json/product-list.json";

function parseCSVBarcodes(csvText) {
  const lines = csvText.trim().split("\n");
  const barcodes = [];

  for (const line of lines) {
    const parts = line.split(";");
    const barcode = parts[7];
    if (barcode) {
      barcodes.push(barcode.trim());
    }
  }

  return barcodes;
}

function prependBarcodesToJson(barcodes, jsonPath) {
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const newEntries = barcodes.map((barcode) => ({
    site: "tamsoft",
    barcode: barcode,
  }));

  const updatedJson = [...newEntries, ...jsonData];

  fs.writeFileSync(jsonPath, JSON.stringify(updatedJson, null, 2), "utf-8");
  console.log(`✅ ${newEntries.length} barkod product-list.json dosyasının en başına eklendi.`);
}

const csvText = fs.readFileSync(CSV_PATH, "utf-8");
const barcodes = parseCSVBarcodes(csvText);
prependBarcodesToJson(barcodes, JSON_PATH);

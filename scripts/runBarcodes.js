const fs = require("fs");
const axios = require("axios");
const { inputPath } = require("./datasFs");

const barcodesPath = inputPath("barcodes.json");

if (!fs.existsSync(barcodesPath)) {
    console.error("input/barcodes.json bulunamadi.");
    process.exit(1);
}

let barcodes;
try {
    const raw = fs.readFileSync(barcodesPath, "utf-8").replace(/^﻿/, "");
    const parsed = JSON.parse(raw);
    barcodes = Array.isArray(parsed) ? parsed : parsed.barcodes;
} catch {
    console.error("input/barcodes.json gecersiz JSON.");
    process.exit(1);
}

if (!Array.isArray(barcodes) || barcodes.length === 0) {
    console.log("input/barcodes.json bos veya gecersiz.");
    process.exit(0);
}

console.log(`${barcodes.length} barkod gonderiliyor...`);

axios.post("http://localhost:3000/api/get-products", { barcodes }, { timeout: 0 })
    .then(res => {
        const results = res.data;
        const found = results.filter(r => r.success).length;
        const notFound = results.filter(r => !r.success).length;
        console.log(`Tamamlandi: ${found} bulundu, ${notFound} bulunamadi.`);
    })
    .catch(err => {
        console.error("Istek hatasi:", err.message);
    });

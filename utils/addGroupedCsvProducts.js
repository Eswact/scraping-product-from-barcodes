const fs = require("fs");
const path = require("path");
const readline = require("readline");

const csvPath = path.join(__dirname, "../datas/csv/trendyol.csv");
const productListPath = path.join(__dirname, "../datas/json/product-list.json");
const skippedBarcodesPath = path.join(__dirname, "../datas/json/skipped-barcodes.json");

const groupedProducts = new Map();

// Mevcut product-list.json'dan barkodları topla
const existingProductList = JSON.parse(fs.readFileSync(productListPath, "utf-8"));
const existingBarcodes = new Set();

existingProductList.forEach((item) => {
  if (Array.isArray(item.barcode)) {
    item.barcode.forEach((b) => existingBarcodes.add(b));
  } else {
    existingBarcodes.add(item.barcode);
  }
});

const skippedBarcodes = [];

const rl = readline.createInterface({
  input: fs.createReadStream(csvPath),
  crlfDelay: Infinity,
});

rl.on("line", (line) => {
  const [id, barcode, title, imageUrl] = line.split(";").map((s) => s.trim());
  if (!barcode || !imageUrl || !title) return;

  if (groupedProducts.has(imageUrl)) {
    groupedProducts.get(imageUrl).barcodes.push(barcode);
  } else {
    groupedProducts.set(imageUrl, {
      barcodes: [barcode],
      productTitle: title,
      productImgSrc: imageUrl,
    });
  }
});

rl.on("close", () => {
  let addedCount = 0;

  for (const [imageUrl, product] of groupedProducts.entries()) {
    const filteredBarcodes = product.barcodes.filter((b) => !existingBarcodes.has(b));

    if (filteredBarcodes.length === 0) {
      skippedBarcodes.push(...product.barcodes);
      continue;
    }

    const entry = {
      site: "tamsoft",
      barcode: filteredBarcodes.length === 1 ? filteredBarcodes[0] : filteredBarcodes,
      productList: [
        {
          productImgSrc: product.productImgSrc,
          productTitle: product.productTitle,
        },
      ],
    };

    existingProductList.push(entry);
    addedCount++;

    filteredBarcodes.forEach((b) => existingBarcodes.add(b));
  }

  fs.writeFileSync(productListPath, JSON.stringify(existingProductList, null, 2), "utf-8");
  fs.writeFileSync(skippedBarcodesPath, JSON.stringify(skippedBarcodes, null, 2), "utf-8");

  console.log(`✅ Toplam ${addedCount} yeni grup eklendi.`);
  console.log(`⚠️ ${skippedBarcodes.length} barkod zaten vardı, skipped-barcodes.json'a yazıldı.`);
});
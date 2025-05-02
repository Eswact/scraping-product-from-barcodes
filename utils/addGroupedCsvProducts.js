const fs = require("fs");
const csv = require("csv-parser");

const csvPath = "./datas/csv/new/869_list.csv";
const outputPath = "./datas/json/product-list-new.json";
const existingBarcodesPath = "./datas/json/product-list.json";
const skippedBarcodesPath = "./datas/json/skipped-barcodes.json";

const rawBarcodes = JSON.parse(fs.readFileSync(existingBarcodesPath, "utf-8"));
const existingBarcodes = [];
rawBarcodes.forEach((item) => {
  if (Array.isArray(item.barcode)) {
    existingBarcodes.push(...item.barcode);
  } else {
    existingBarcodes.push(item.barcode);
  }
});


const groupedProducts = {};
const skippedBarcodes = [];

fs.createReadStream(csvPath)
  .pipe(csv({ separator: ";" }))
  .on("data", (row) => {
    const barcode = row[Object.keys(row)[0]];
    const productTitle = row[Object.keys(row)[1]];
    const productImgSrc = row[Object.keys(row)[2]];

    if (existingBarcodes.includes(barcode)) {
      console.log(`🔁 Barkod atlandı (zaten var): ${barcode}`);
      skippedBarcodes.push(barcode);
      return;
    }

    const key = `${productTitle}||${productImgSrc}`;

    if (!groupedProducts[key]) {
      groupedProducts[key] = {
        site: "tamsoft",
        barcode: [barcode],
        productList: [
          {
            productImgSrc,
            productTitle,
          },
        ],
      };
    } else {
      groupedProducts[key].barcode.push(barcode);
    }
  })
  .on("end", () => {
    const outputArray = Object.values(groupedProducts).map((item) => {
      if (item.barcode.length === 1) {
        item.barcode = item.barcode[0]; // tek barkodsa string'e çevir
      }
      return item;
    });

    fs.writeFileSync(outputPath, JSON.stringify(outputArray, null, 2), "utf-8");
    fs.writeFileSync(skippedBarcodesPath, JSON.stringify(skippedBarcodes, null, 2), "utf-8");
    console.log(`✅ JSON dosyası oluşturuldu: ${outputPath}`);
  });

const fs = require("fs");
const { outputPath, ensureDirForFile } = require("./datasFs");

const updatedProductListPath = outputPath("updated-product-list.json");
const csvPath = outputPath("product-list.csv");

if (!fs.existsSync(updatedProductListPath)) {
    console.error("updated-product-list.json bulunamadi. Once downloadAndUpdate.js'i calistir.");
    process.exit(1);
}

const productList = JSON.parse(fs.readFileSync(updatedProductListPath, "utf-8"));

function escapeCsv(value) {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

const header = ["barcode", "site", "productTitle", "productPrice", "productImgSrc"];
const rows = [header.join(",")];

for (const product of productList) {
    const barcode = product.barcode;
    const site = product.site || "";
    const item = product.productList?.[0] || {};

    if (Array.isArray(barcode)) {
        for (const b of barcode) {
            const imgSrc = `images/${b}.jpg`;
            rows.push([b, site, item.productTitle || "", item.productPrice || "", imgSrc].map(escapeCsv).join(","));
        }
    } else {
        rows.push([barcode, site, item.productTitle || "", item.productPrice || "", item.productImgSrc || ""].map(escapeCsv).join(","));
    }
}

ensureDirForFile(csvPath);
fs.writeFileSync(csvPath, rows.join("\n"), "utf-8");
console.log(`product-list.csv olusturuldu: ${rows.length - 1} satir.`);

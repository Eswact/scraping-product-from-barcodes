const fs = require("fs");
const path = require("path");
const { outputPath, outputDir } = require("./datasFs");

function loadJsonArray(filename) {
    const p = outputPath(filename);
    if (!fs.existsSync(p)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(p, "utf8"));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

const productList = loadJsonArray("product-list.json");
const updatedProductList = loadJsonArray("updated-product-list.json");
const notFound = loadJsonArray("not-found-barcodes.json");
const cannotDownload = loadJsonArray("cannot-download-images.json");
const imagesDir = path.join(outputDir(), "images");

console.log("TOPLAM BULUNAN    :", productList.length);
console.log("TOPLAM BULUNAMAYAN:", notFound.length);
console.log("UPDATED LIST      :", updatedProductList.length);
console.log("INDIRILEMEYEN     :", cannotDownload.length);

if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    console.log("INDIRILEN RESIM   :", files.length);
} else {
    console.log("INDIRILEN RESIM   : 0 (images klasoru yok)");
}

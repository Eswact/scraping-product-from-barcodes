const fs = require('fs');
const path = require('path');

const productListPath = path.join(__dirname, "../datas/json/product-list.json");
const imagesDir = path.join(__dirname, "../datas/images");
const cannotDownloadedImagesPath = path.join(__dirname, "../datas/json/cannot-downloaded-images.json");

const productList = JSON.parse(fs.readFileSync(productListPath, "utf-8"));

const productListWithImageLink = productList.filter(x => x.productList);

const images = fs.readdirSync(imagesDir).map(file => path.parse(file).name);

const missingBarcodes = [];

productListWithImageLink.forEach(product => {
    const imgSrc = product.productList[0]?.productImgSrc || '';

    if (Array.isArray(product.barcode)) {
        product.barcode.forEach(barcode => {
        if (!images.includes(barcode)) {
            missingBarcodes.push({ barcode, productImgSrc: imgSrc });
        }
        });
    } else {
        if (!images.includes(product.barcode)) {
            missingBarcodes.push({ barcode: product.barcode, productImgSrc: imgSrc });
        }
    }
});

fs.writeFileSync(cannotDownloadedImagesPath, JSON.stringify(missingBarcodes, null, 2), 'utf-8');

console.log(`✅ Eksik görsellerin barkodları kaydedildi: ${cannotDownloadedImagesPath}`);
console.log(`Eksik barkod sayısı: ${missingBarcodes.length}`);

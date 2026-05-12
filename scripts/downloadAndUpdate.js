const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { outputPath, outputDir, ensureDirForFile } = require("./datasFs");

const productListPath = outputPath("product-list.json");
const updatedProductListPath = outputPath("updated-product-list.json");
const cannotDownloadPath = outputPath("cannot-download-images.json");
const imagesDir = path.join(outputDir(), "images");

if (!fs.existsSync(productListPath)) {
    console.error("product-list.json bulunamadi. Once scraper'i calistir.");
    process.exit(1);
}

const productList = JSON.parse(fs.readFileSync(productListPath, "utf-8"));
fs.mkdirSync(imagesDir, { recursive: true });

async function downloadImage(url, filePath) {
    if (fs.existsSync(filePath)) return true;
    try {
        const response = await axios({ url, method: "GET", responseType: "stream" });
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on("finish", () => resolve(true));
            writer.on("error", () => resolve(false));
        });
    } catch {
        return false;
    }
}

async function run() {
    const cannotDownload = [];
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < productList.length; i++) {
        const product = productList[i];
        const imgUrl = product.product?.productImgSrc;
        if (!imgUrl) continue;

        const barcodes = Array.isArray(product.barcode) ? product.barcode : [product.barcode];

        for (const barcode of barcodes) {
            const filePath = path.join(imagesDir, `${barcode}.jpg`);
            if (fs.existsSync(filePath)) {
                skipped++;
                continue;
            }
            const ok = await downloadImage(imgUrl, filePath);
            if (ok) {
                downloaded++;
            } else {
                failed++;
                if (!cannotDownload.includes(barcode)) cannotDownload.push(barcode);
            }
        }

        if ((i + 1) % 500 === 0) {
            console.log(`[${i + 1}/${productList.length}] indiriliyor...`);
        }

        await new Promise(r => setTimeout(r, 80));
    }

    console.log(`Tamamlandi: ${downloaded} indirildi, ${skipped} zaten vardi, ${failed} basarisiz.`);

    if (cannotDownload.length > 0) {
        ensureDirForFile(cannotDownloadPath);
        fs.writeFileSync(cannotDownloadPath, JSON.stringify(cannotDownload, null, 2));
        console.log(`cannot-download-images.json olusturuldu: ${cannotDownload.length} barkod.`);
    }

    const updatedList = productList.map((product) => {
        const p = { ...product };
        if (!Array.isArray(p.barcode)) {
            if (p.product?.productImgSrc) {
                p.product = { ...p.product, productImgSrc: `images/${p.barcode}.jpg` };
            }
        } else {
            const title = p.product?.productTitle || "";
            p.product = { productTitle: title, productImgSrc: `images/${p.barcode[0]}.jpg` };
        }
        return p;
    });

    ensureDirForFile(updatedProductListPath);
    fs.writeFileSync(updatedProductListPath, JSON.stringify(updatedList, null, 2));
    console.log(`updated-product-list.json olusturuldu: ${updatedList.length} urun.`);
}

run();

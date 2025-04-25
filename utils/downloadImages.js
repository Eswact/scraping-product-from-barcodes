const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { createWriteStream } = require("fs");
const productListPath = path.join(__dirname, "../datas/json/product-list.json");
const imagesFolderPath = path.join(__dirname, "../datas/images");

var canNotDownloaded = [];

if (!fs.existsSync(imagesFolderPath)) {
  fs.mkdirSync(imagesFolderPath);
}

// Product list dosyasını oku
const productList = JSON.parse(fs.readFileSync(productListPath, "utf-8"));

// İndirme fonksiyonu
async function downloadImage(url, filename) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });
    const writer = createWriteStream(path.join(imagesFolderPath, filename));
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`❗ Resim indirilemedi: ${url}, Hata: ${error.message}`);
    return false;
  }
}

// Ürün işleme fonksiyonu
async function processProductImages() {
  let processedCount = 0;
  let failedCount = 0;

  // Ürün listesinde her ürün için döngü
  for (let index = 0; index < productList.length; index++) {
    const product = productList[index];
    try {

      if (product.site !== "sarperMarket") {
        if (product.productList && product.productList.length > 0) {
          const productDetails = product.productList[0];

          if (productDetails.productImgSrc) {
            if ((index + 1) % 1000 === 0) {
              console.log(`İşlemdeki Ürün: ${index + 1} / ${productList.length}`);
            }
            const imgUrl = productDetails.productImgSrc;
            const barcodes = Array.isArray(product.barcode) ? product.barcode : [product.barcode];

            // Barcode'lar için resimleri indir
            for (const barcode of barcodes) {
              const fileName = `${barcode}.jpg`;

              const downloadSuccess = await downloadImage(imgUrl, fileName);
              if (downloadSuccess) {
                processedCount++;
              } else {
                failedCount++;
                canNotDownloaded.push(product);
              }

              // Rastgele gecikme ekle
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
      }
    } catch (error) {
      failedCount++;
      canNotDownloaded.push(product);
      console.error(`❗ Hata: ${error.message}`);
    }
  }

  if (canNotDownloaded.length > 0) {
    fs.writeFileSync("datas/json/cannot-download-product-list.json", JSON.stringify(canNotDownloaded, null, 2));
    console.log(`❗ ${failedCount} ürün indirilemedi. ${canNotDownloaded.length} ürün dosyaya kaydedildi.`);
  }

  console.log(`✅ İndirme işlemi tamamlandı. Başarıyla indirilen: ${processedCount} resim.`);
}

processProductImages();
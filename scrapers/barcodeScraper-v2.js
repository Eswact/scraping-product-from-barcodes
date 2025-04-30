const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const productListPath = "datas/json/product-list-new.json";
const notFoundPath = "datas/json/notfound-barcodes.json";

// const quickTimeoutMarkets = ["carrefour", "pazarama"];

const webList = {
  showSanal: "https://api.showsanal.com/api/home/slug/search?q=",

  trendyol: "https://www.trendyol.com/sr?q=",
  hepsiburada: "https://www.hepsiburada.com/ara?q=",
  pazarama: "https://www.pazarama.com/arama?q=",
  onurMarket: "https://www.onurmarket.com/Arama?1&kelime=",
  mopas: "https://www.mopas.com.tr/search/?text=",
  aftaMarket: "https://www.aftamarket.com.tr/arama?q=",
  carrefour: "https://www.carrefoursa.com/search/?text=",
  marketKarsilastir: "https://marketkarsilastir.com/ara/",

}

const parsers = {
  mopas: ($) => {
    if ($(".product-list-grid .card").get().length > 1) {
      return false;
    }
    return $(".product-list-grid .card").get().map((el) => {
      const productImgSrc = $(el).find("img").attr("src") || "";
      const productTitle = $(el).find(".product-title").text().trim() || "";
      const productPrice = $(el).find(".sale-price").text().trim() || "";
      return { productImgSrc, productTitle, productPrice };
    });
  },

  onurMarket: ($) => {
    if ($("#ProductPageProductList .productItem").get().length > 1) {
      return false;
    }
    return $("#ProductPageProductList .productItem").get().map((el) => {
      const productImgSrc = $(el).find("img").data("original") || "";
      const productTitle = $(el).find(".productName a").text().trim() || "";
      const productPrice = $(el).find(".productPrice .discountPriceSpan").text().trim() || "";
      return { productImgSrc, productTitle, productPrice };
    });
  },

  aftaMarket: ($) => {
    if ($(".catalogWrapper .productItem").get().length > 1) {
      return false;
    }
    return $(".catalogWrapper .productItem").get().map((el) => {
      const productImgSrc = $(el).find(".stImage").data("src") || "";
      const productTitle = $(el).find(".vitrin-urun-adi").text().trim() || "";
      const productPrice = $(el).find(".productPrice .currentPrice").text().trim() || "";
      return { productImgSrc, productTitle, productPrice };
    });
  },

  pazarama: ($) => {
    if ($(".product-card").get().length > 1) {
      return false;
    }
    return $(".product-card").get().map((el) => {
      const productImgSrc = $(el).find("picture img:first-child").attr("src") || "";
      const productTitle = $(el).find("div[data-testid='product-card-title']").text().trim() || "";
      const productPrice = $(el).find(".product-card__price .leading-tight").text().trim() || "";
      return { productImgSrc, productTitle, productPrice };
    });
  },

  carrefour: ($) => {
    if ($(".product-listing .product-listing-item .hover-box").get().length > 1) {
      return false;
    }
    return $(".product-listing .product-listing-item .hover-box").get().map((el) => {
      const productImgSrc = $(el).find("img").attr("src") || "";
      const productTitle = $(el).find(".item-name").text().trim() || "";
      const productPrice = $(el).find(".item-price").attr("content") || "";
      return { productImgSrc, productTitle, productPrice };
    });
  },

  marketKarsilastir: ($) => {
    if ($(".product-list li.item").get().length > 1) {
      return false;
    }
    return $(".product-list li.item").get().map((el) => {
      const productImgSrc = $(el).find(".product-img img").attr("src") || "";
      const productTitle = $(el).find(".product-info a.pi-name").text().trim() || "";
      return { productImgSrc, productTitle };
    });
  },

  showSanal: (data) => {
    let productList = data.page.find(x => x.$type === "row-multiple").columns[1].contents[1].columns[0].content.products;
    if (productList && productList.length > 0) {
      return [{
        productImgSrc: productList[0].product.imageUrl,
        productTitle: productList[0].product.name,
        productPrice: productList[0].product.price,
      }];
    }
    return [];
  },

  trendyol: ($) => {
    if ($(".srch-rslt-title .dscrptn dscrptn-V2 h2").text().includes("bulunamadı")) {
      return false;
    }
    else {
      return $(".prdct-cntnr-wrppr .p-card-wrppr").get().map((el) => {
        const productImgSrc = $(el).find(".p-card-img-wr:first-child .p-card-img:first-child").attr("src") || "";
        const productTitle = $(el).find(".prdct-desc-cntnr-ttl-w").text().trim() + " " + $(el).find(".prdct-desc-cntnr-name").text().trim() || "";
        const productPrice = $(el).find(".price-information .price-item").text().trim() || "";
        return { productImgSrc, productTitle, productPrice };
      });
    }
  },

  hepsiburada: ($) => {
    if ($(".SearchResultSummary").text().includes("bulduk")) {
      return $(".ProductList ul li").get().map((el, i) => {
        const productImgSrc = $(el).find("picture img").attr("src") || "";
        const productTitle = $(el).find(`h2[data-test-id="title-${i+1}"]`).text().trim() + " " + $(el).find(".prdct-desc-cntnr-name").text().trim() || "";
        const productPrice = $(el).find(`div[data-test-id="final-price-${i+1}"]`).text().trim() || "";
        return { productImgSrc, productTitle, productPrice };
      });
    }
    else {
      return false;
    }
  }
};

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizePrice(price) {
  if (typeof price === "number") {
    return price.toFixed(2);
  }

  if (typeof price === "string") {
    const cleaned = price
      .replace(/[^0-9.,]/g, "")
      .replace(/\s+/g, "")
      .replace(",", ".");

    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      return parsed.toFixed(2);
    }
  }

  return "0.00";
}

function addProductList(product) {
  let existingList = [];
  try {
    if (fs.existsSync(productListPath)) {
      const raw = fs.readFileSync(productListPath);
      existingList = JSON.parse(raw);
    }
  } catch (readErr) {
    console.warn("⚠️ product-list.json okunamadı:", readErr.message);
  }

  const alreadyExists = existingList.find(item => item.barcode === product.barcode);
  if (!alreadyExists) {
    existingList.push(product);
    try {
      fs.writeFileSync(productListPath, JSON.stringify(existingList, null, 2));
      console.log("✅📦 product-list.json güncellendi.");
    } catch (writeErr) {
      console.warn("⚠️ product-list.json yazılamadı:", writeErr.message);
    }
  } else {
    // console.log("🔁 Bu barkod product-list.json'da zaten var.");
  }
}

function addNotFoundBarcode(barcode) {
  let notFoundList = [];
  if (fs.existsSync(notFoundPath)) {
    const fileContent = fs.readFileSync(notFoundPath, "utf-8");
    try {
      notFoundList = JSON.parse(fileContent);
    } catch (e) {
      console.warn("❗ notfound-barcodes.json geçersiz formatta, sıfırlanıyor.");
      notFoundList = [];
    }
  }

  if (!notFoundList.includes(barcode)) {
    notFoundList.push(barcode);
    fs.writeFileSync(notFoundPath, JSON.stringify(notFoundList, null, 2));
    console.log(`❌📦 ${barcode} -> notfound-barcodes.json dosyasına eklendi.`);
  }
}

async function fetchBarcode(barcode) {
  // await new Promise(resolve => setTimeout(resolve, randomInteger(200, 400)));

  const fetchTasks = Object.entries(webList).map(async ([marketName, baseUrl]) => {
    await new Promise(resolve => setTimeout(resolve, randomInteger(200, 400)));
    try {
      // console.log(`${marketName} kontrol ediliyor...`);

      const { data } = await axios.get(baseUrl + barcode, {
        headers: { "User-Agent": "Mozilla/5.0" },
        // timeout: quickTimeoutMarkets.includes(marketName) ? 2000 : 10000,
      });

      const $ = (marketName != 'showSanal') ? cheerio.load(data) : data;
      const productListArray = parsers[marketName]($);

      if (productListArray.length >= 1) {
        if (productListArray[0].productPrice) {
          productListArray[0].productPrice = normalizePrice(productListArray[0].productPrice);
        }

        const result = {
          site: marketName,
          barcode: barcode,
          productList: [ productListArray[0] ],
        };

        addProductList(result);

        fs.writeFileSync("datas/json/last-added-product.json", JSON.stringify(result, null, 2));
        // console.log(`✅ ${marketName} üzerinden ürün bulundu ve kaydedildi.`);

        return { success: true, ...result };
      }
    } catch (err) {
      console.warn(`⚠️ ${marketName} hatası: ${err.message}`);
      return null;
    }
  });

  const results = await Promise.all(fetchTasks);

  const successResult = results.find(r => r && r.success);
  if (successResult) {
    return successResult;
  } else {
    // console.log(`❌ ${barcode}: Hiçbir sitede ürün bulunamadı.`);
    addNotFoundBarcode(barcode);
    return { success: false, message: "❌ Hiçbir sitede ürün bulunamadı." };
  }
}

async function fetchBarcodes(barcodes, barcodesPerRequest = 5) {
  let startIndex = 0;
  let requestCount = Math.ceil(barcodes.length / barcodesPerRequest);

  for (let i = 0; i < requestCount; i++) {
    console.log(`[${startIndex}/${barcodes.length}]`);
    const promises = [];

    for (let j = 0; j < barcodesPerRequest; j++) {
      const index = startIndex + j;
      if (index >= barcodes.length) break;
      const barcode = barcodes[index];
      promises.push(fetchBarcode(barcode));
    }

    await Promise.all(promises);
    startIndex += barcodesPerRequest;

    await new Promise(resolve => setTimeout(resolve, randomInteger(500, 1000)));
  }
}


module.exports = { fetchBarcode, fetchBarcodes };
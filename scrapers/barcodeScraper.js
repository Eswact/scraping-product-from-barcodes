const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const productListPath = "datas/json/product-list.json";
const notFoundPath = "datas/json/notfound-barcodes.json";

const quickTimeoutMarkets = ["carrefour", "pazarama"];

const webList = {
  mopas: "https://www.mopas.com.tr/search/?text=",
  onurMarket: "https://www.onurmarket.com/Arama?1&kelime=",
  aftaMarket: "https://www.aftamarket.com.tr/arama?q=",
  pazarama: "https://www.pazarama.com/arama?q=",
  carrefour: "https://www.carrefoursa.com/search/?text=",
  marketKarsilastir: "https://marketkarsilastir.com/ara/",
  // showSanal: "https://showsanal.com/search?q=",
}

const apiList = {
  showSanal: "https://api.showsanal.com/api/home/slug/search?q=",
}

const parsers = {
  mopas: ($) => {
    return $(".product-list-grid .card").get().map((el) => {
      const productImgSrc = $(el).find("img").attr("src") || "";
      const productTitle = $(el).find(".product-title").text().trim() || "";
      const productPrice = $(el).find(".sale-price").text().trim() || "";
      return { productImgSrc, productTitle, productPrice };
    });
  },

  onurMarket: ($) => {
    return $("#ProductPageProductList .productItem").get().map((el) => {
      const productImgSrc = $(el).find("img").data("original") || "";
      const productTitle = $(el).find(".productName a").text().trim() || "";
      const productPrice = $(el).find(".productPrice .discountPriceSpan").text().trim() || "";
      return { productImgSrc, productTitle, productPrice };
    });
  },

  aftaMarket: ($) => {
    return $(".catalogWrapper .productItem").get().map((el) => {
      const productImgSrc = $(el).find(".stImage").data("src") || "";
      const productTitle = $(el).find(".vitrin-urun-adi").text().trim() || "";
      const productPrice = $(el).find(".productPrice .currentPrice").text().trim() || "";
      return { productImgSrc, productTitle, productPrice };
    });
  },

  pazarama: ($) => {
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
};

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
      console.log("📦 product-list.json güncellendi.");
    } catch (writeErr) {
      console.warn("⚠️ product-list.json yazılamadı:", writeErr.message);
    }
  } else {
    console.log("🔁 Bu barkod product-list.json'da zaten var.");
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
    console.log(`📦 ${barcode} -> notfound-barcodes.json dosyasına eklendi.`);
  }
}

async function fetchBarcode(barcode, lastMarket = null) {
  // API List
  for (const [marketName, baseUrl] of Object.entries(apiList)) {
    if (marketName === lastMarket) {
      console.log(`⏳ ${marketName} art arda çağrılıyor, 200ms bekleniyor...`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    try {
      console.log(`${marketName} kontrol ediliyor...`);
      const { data } = await axios.get(baseUrl + barcode, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      const productListArray = parsers[marketName](data);

      if (productListArray.length === 1) {
        if (productListArray[0].productPrice) {
          productListArray[0].productPrice = normalizePrice(productListArray[0].productPrice);
        }

        const result = {
          site: marketName,
          barcode: barcode,
          productList: productListArray,
        };

        addProductList(result);

        fs.writeFileSync("datas/json/last-added-product.json", JSON.stringify(result, null, 2));
        console.log(`✅ ${marketName} üzerinden ürün bulundu ve kaydedildi.`);

        return { success: true, ...result };
      }
    } catch (err) {
      console.warn(`⚠️ ${marketName} hatası: ${err.message}`);
      continue;
    }
  }

  // Web Scraper
  for (const [marketName, baseUrl] of Object.entries(webList)) {
    if (marketName === lastMarket) {
      console.log(`⏳ ${marketName} art arda çağrılıyor, 200ms bekleniyor...`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    try {
      console.log(`${marketName} kontrol ediliyor...`);
      const isQuickMarket = quickTimeoutMarkets.includes(marketName);
      const { data } = await axios.get(baseUrl + barcode, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: isQuickMarket ? 2000 : 10000,
      });

      const $ = cheerio.load(data);
      const productListArray = parsers[marketName]($);

      if (productListArray.length === 1) {
        if (productListArray[0].productPrice) {
          productListArray[0].productPrice = normalizePrice(productListArray[0].productPrice);
        }

        const result = {
          site: marketName,
          barcode: barcode,
          productList: productListArray,
        };

        addProductList(result);

        fs.writeFileSync("datas/json/last-added-product.json", JSON.stringify(result, null, 2));
        console.log(`✅ ${marketName} üzerinden ürün bulundu ve kaydedildi.`);

        return { success: true, ...result };
      }
    } catch (err) {
      console.warn(`⚠️ ${marketName} hatası: ${err.message}`);
      continue;
    }
  }

  console.log(`❌ ${barcode}: Hiçbir sitede ürün bulunamadı.`);
  addNotFoundBarcode(barcode);
  return { success: false, message: "❌ Hiçbir sitede ürün bulunamadı." };
}

module.exports = { fetchBarcode };
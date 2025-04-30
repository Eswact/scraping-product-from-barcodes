// imports
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");

// parameters
const productListPath = "datas/json/product-list-new.json";
const notFoundPath = "datas/json/notfound-barcodes.json";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const BATCH_SIZE = 8; // number of barcodes to fetch at once
const MAX_TABS = 4; // webList.object.keys().length
const WAIT_BETWEEN_REQUESTS_MS = 500;

const webList = {
    trendyol: "https://www.trendyol.com/sr?q=",
    hepsiburada: "https://www.hepsiburada.com/ara?q=",
    pazarama: "https://www.pazarama.com/arama?q=",
    onurMarket: "https://www.onurmarket.com/Arama?1&kelime=",

    // showSanal: "https://api.showsanal.com/api/home/slug/search?q=",
    // mopas: "https://www.mopas.com.tr/search/?text=",
    // aftaMarket: "https://www.aftamarket.com.tr/arama?q=",
    // carrefour: "https://www.carrefoursa.com/search/?text=",
    // marketKarsilastir: "https://marketkarsilastir.com/ara/",
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
        if ($(".srch-rslt-title .srch-ttl-cntnr-wrppr h2").text().includes("bulunamadı")) {
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
                const productTitle = $(el).find(`h2[data-test-id="title-${i + 1}"]`).text().trim() + " " + $(el).find(".prdct-desc-cntnr-name").text().trim() || "";
                const productPrice = $(el).find(`div[data-test-id="final-price-${i + 1}"]`).text().trim() || "";
                return { productImgSrc, productTitle, productPrice };
            });
        }
        else {
            return false;
        }
    }
};

// utils
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

// functions
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


// scraper
async function scrapeSinglePage(page, marketName, baseUrl, barcode) {
    try {
        const url = baseUrl + barcode;
        await page.setUserAgent(USER_AGENT);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

        const content = await page.content();
        const $ = cheerio.load(content);

        const productListArray = parsers[marketName]($);

        if (productListArray.length && productListArray[0].productPrice) {
            productListArray[0].productPrice = normalizePrice(productListArray[0].productPrice);

            const result = {
                success: true,
                site: marketName,
                barcode: barcode,
                productList: [productListArray[0]],
            };

            fs.writeFileSync("datas/json/last-added-product.json", JSON.stringify(result, null, 2));
            return result;
        }

    } catch (err) {
        console.warn(`⚠️ ${marketName} hatası: ${err.message}`);
    }

    return null;
}

async function fetchBarcode(barcode, browser) {
    const marketEntries = Object.entries(webList);

    for (let i = 0; i < marketEntries.length; i += MAX_TABS) {
        const batch = marketEntries.slice(i, i + MAX_TABS);

        const promises = batch.map(async ([marketName, baseUrl]) => {
            const page = await browser.newPage();
            const result = await scrapeSinglePage(page, marketName, baseUrl, barcode);
            await page.close();
            return result;
        });

        const results = await Promise.allSettled(promises);
        const success = results.find(r => r.status === "fulfilled" && r.value && r.value.success);

        if (success) {
            addProductList(success.value);
            return success.value;
        }

        await new Promise(res => setTimeout(res, WAIT_BETWEEN_REQUESTS_MS));
    }

    addNotFoundBarcode(barcode);
    return { success: false, message: "❌ Ürün bulunamadı: " + barcode };
}

async function fetchBarcodes(barcodes, browser) {
    const results = [];

    for (let i = 0; i < barcodes.length; i += BATCH_SIZE) {
        const batch = barcodes.slice(i, i + BATCH_SIZE);
        console.log(`[${i + BATCH_SIZE}/${barcodes.length}]`);

        const promises = batch.map(async (barcode, idx) => {
            const result = await fetchBarcode(barcode, browser);
            return result;
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);

        await new Promise(res => setTimeout(res, WAIT_BETWEEN_REQUESTS_MS));
    }

    return results;
}

module.exports = { fetchBarcodes };
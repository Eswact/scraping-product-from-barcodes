const cheerio = require("cheerio");
const fs = require("fs");
const { outputPath, ensureDirForFile } = require("../scripts/datasFs");

const productListPath = outputPath("product-list.json");
const notFoundPath = outputPath("not-found-barcodes.json");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const webList = {
    trendyol:          b => `https://www.trendyol.com/sr?q=${b}`,
    hepsiburada:       b => `https://www.hepsiburada.com/ara?q=${b}`,
    pazarama:          b => `https://www.pazarama.com/arama?q=${b}`,
    mopas:             b => `https://www.mopas.com.tr/search/?text=${b}`,
    aftaMarket:        b => `https://www.aftamarket.com.tr/arama?q=${b}`,
    carrefour:         b => `https://www.carrefoursa.com/search/?text=${b}`,
    sokMarket:         b => `https://www.sokmarket.com.tr/arama?q=${b}`,
    marketKarsilastir: b => `https://marketkarsilastir.com/ara?q=${b}&type=barcode`,
};

const parsers = {
    trendyol: ($) => {
        if ($(".did-you-mean .information-banner .information-text").text().includes("bulunamadı")) return false;
        if ($(".search-result-content .product-card").get().length === 0) return false;
        return $(".search-result-content .product-card").get().map((el) => ({
            productImgSrc: $(el).find(".image-wrapper:first-child .image-slider:first-child img:first-child").attr("src") || "",
            productTitle: $(el).find(".brand-name-wrapper .product-brand").text().trim() + " " + $(el).find(".brand-name-wrapper .product-name").text().trim(),
            productPrice: $(el).find(".single-price .price-section").text().trim() || "",
        }));
    },
    hepsiburada: ($) => {
        const firstItem = $('li#i0');
        if (firstItem.length === 0) return false;
        return [{
            productImgSrc: firstItem.find("picture img").attr("src") || "",
            productTitle: firstItem.find('[data-test-id^="title-"] a').text().trim() || "",
            productPrice: firstItem.find('[data-test-id^="final-price-"]').text().trim() || "",
        }];
    },
    pazarama: ($) => {
        if ($(".product-card").get().length > 1) return false;
        return $(".product-card").get().map((el) => ({
            productImgSrc: $(el).find("picture img:first-child").attr("src") || "",
            productTitle: $(el).find("[data-testid='product-card-title']").text().trim() || "",
            productPrice: $(el).find(".product-card__price .leading-tight").last().text().trim() || "",
        }));
    },
    mopas: ($) => {
        if ($(".product-list-grid .card").get().length > 1) return false;
        return $(".product-list-grid .card").get().map((el) => ({
            productImgSrc: $(el).find("img").attr("src") || "",
            productTitle: $(el).find(".product-title").text().trim() || "",
            productPrice: $(el).find(".sale-price").text().trim() || "",
        }));
    },
    aftaMarket: ($) => {
        if ($(".catalogWrapper .productItem").get().length > 1) return false;
        return $(".catalogWrapper .productItem").get().map((el) => ({
            productImgSrc: $(el).find(".stImage").data("src") || "",
            productTitle: $(el).find(".vitrin-urun-adi").text().trim() || "",
            productPrice: $(el).find(".productPrice .currentPrice").text().trim() || "",
        }));
    },
    carrefour: ($) => {
        if ($(".product-listing .product-listing-item .hover-box").get().length > 1) return false;
        return $(".product-listing .product-listing-item .hover-box").get().map((el) => ({
            productImgSrc: $(el).find("img").attr("src") || "",
            productTitle: $(el).find(".item-name").text().trim() || "",
            productPrice: $(el).find(".item-price").attr("content") || "",
        }));
    },
    marketKarsilastir: ($) => {
        if ($("#productsContainer .col-6.col-md-4.col-lg-3").get().length < 1) return false;
        if ($("#productsContainer .col-6.col-md-4.col-lg-3 .product-card").get().length > 1) return false;
        if ($(".empty-state").get().length < 1) return false;
        return $("#productsContainer .col-6.col-md-4.col-lg-3 .product-card").get().map((el) => ({
            productImgSrc: $(el).find(".product-image").attr("src") || "",
            productTitle: $(el).find(".product-card-body .product-name").text().trim() || "",
            productPrice: $(el).find(".product-card-body .product-price-badge").text().trim() || "",
        }));
    },
    sokMarket: ($) => {
        const emptyResultText = $('p:contains("İlgili Sonuç Bulunamadı")').length > 0;
        const noProductsText = $('p:contains("0 adet ürün listelendi")').length > 0;
        if (emptyResultText || noProductsText) return false;
        const productCards = $(".CProductCard-module_productCardWrapper__okAmT, [class*='productCardWrapper']");
        if (productCards.length === 0) return false;

        return productCards.get().map((el) => {
            const productPrice = $(el).find("[class*='CPriceBox-module_price'], .CPriceBox-module_price__bYk-c").first().text().trim() || "";
            const productTitle = $(el).find("[class*='CProductCard-module_title'], .CProductCard-module_title__u8bMW").first().text().trim() || "";
            const productImgSrc = $(el).find("[class*='CProductCard-module_title'] img, .CProductCard-module_imageContainer__aTMdz img").attr("src") || "";

            return { productImgSrc, productTitle, productPrice };
        });
    },
    marketKarsilastir: ($) => {
        const cards = $(".product-card").get();
        if (cards.length === 0) return false;
        return cards.slice(0, 1).map((el) => {
            const productImgSrc = $(el).find(".product-image").attr("src") || "";
            const productTitle = $(el).find(".product-name").text().trim() || "";
            const productPrice = $(el).find(".product-price-badge").clone().children("small").remove().end().text().trim() || "";
            return { productImgSrc, productTitle, productPrice };
        });
    },
};

function normalizePrice(price) {
    if (typeof price === "number") return price.toFixed(2);
    if (typeof price === "string") {
        const cleaned = price.replace(/[^0-9.,]/g, "").replace(/\s+/g, "").replace(",", ".");
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) return parsed.toFixed(2);
    }
    return "0.00";
}

function loadProductList() {
    if (!fs.existsSync(productListPath)) return [];
    try { return JSON.parse(fs.readFileSync(productListPath)); } catch { return []; }
}

function addProductList(product) {
    const existingList = loadProductList();
    if (existingList.find(item => item.barcode === product.barcode)) return;
    existingList.push(product);
    try {
        ensureDirForFile(productListPath);
        fs.writeFileSync(productListPath, JSON.stringify(existingList, null, 2));
    } catch (err) {
        console.warn("product-list.json yazilamadi:", err.message);
    }
}

function addNotFoundBarcode(barcode) {
    let list = [];
    if (fs.existsSync(notFoundPath)) {
        try { list = JSON.parse(fs.readFileSync(notFoundPath, "utf-8")); } catch { list = []; }
    }
    if (!list.includes(barcode)) {
        list.push(barcode);
        ensureDirForFile(notFoundPath);
        fs.writeFileSync(notFoundPath, JSON.stringify(list, null, 2));
    }
}

async function fetchBarcode(barcode, pages) {
    const marketEntries = Object.entries(pages);
    let done = false;
    let completedCount = 0;

    return new Promise((resolve) => {
        const finish = (result) => { if (done) return; done = true; resolve(result); };

        for (const [marketName, page] of marketEntries) {
            (async () => {
                try {
                    await page.goto(webList[marketName](barcode), { waitUntil: "domcontentloaded", timeout: 15000 });
                    if (done) return;
                    const $ = cheerio.load(await page.content());
                    const items = parsers[marketName]($);
                    if (items && items.length && items[0].productPrice) {
                        items[0].productPrice = normalizePrice(items[0].productPrice);
                        const result = { success: true, site: marketName, barcode, productList: [items[0]] };
                        addProductList(result);
                        console.log(`[OK] ${marketName} -> ${barcode}`);
                        finish(result);
                    }
                } catch (err) {
                    if (!done) console.warn(`[WARN] ${marketName}: ${err.message}`);
                } finally {
                    completedCount++;
                    if (completedCount === marketEntries.length && !done) {
                        addNotFoundBarcode(barcode);
                        console.log(`[NOT FOUND] ${barcode}`);
                        finish({ success: false, barcode, message: "Urun bulunamadi" });
                    }
                }
            })();
        }
    });
}

async function fetchBarcodes(barcodes, browser, onResult = null) {
    const productList = loadProductList();
    const existingMap = new Map(productList.map(p => [String(p.barcode), p]));
    const toFetch = barcodes.filter(b => !existingMap.has(String(b)));

    if (toFetch.length < barcodes.length) {
        console.log(`[SKIP] ${barcodes.length - toFetch.length} barkod zaten mevcut.`);
    }

    let pages = null;
    if (toFetch.length > 0) {
        pages = {};
        for (const marketName of Object.keys(webList)) {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            pages[marketName] = page;
        }
        console.log(`[START] ${Object.keys(pages).length} tab acildi. ${toFetch.length} barkod islenecek.`);
    }

    const results = [];
    let fetchCount = 0;

    for (const barcode of barcodes) {
        let result;
        if (existingMap.has(String(barcode))) {
            result = { ...existingMap.get(String(barcode)), success: true };
        } else {
            fetchCount++;
            console.log(`[${fetchCount}/${toFetch.length}] -> ${barcode}`);
            result = await fetchBarcode(barcode, pages);
        }
        if (onResult) onResult(result);
        results.push(result);
    }

    if (pages) {
        for (const page of Object.values(pages)) await page.close().catch(() => {});
    }

    return results;
}

module.exports = { fetchBarcodes };

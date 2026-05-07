const cheerio = require("cheerio");
const fs = require("fs");
const { outputPath, ensureDirForFile } = require("../scripts/datasFs");

const productListPath = outputPath("product-list.json");
const notFoundPath = outputPath("not-found-barcodes.json");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const webList = {
    trendyol: "https://www.trendyol.com/sr?q=",
    hepsiburada: "https://www.hepsiburada.com/ara?q=",
    pazarama: "https://www.pazarama.com/arama?q=",
    mopas: "https://www.mopas.com.tr/search/?text=",
    aftaMarket: "https://www.aftamarket.com.tr/arama?q=",
    carrefour: "https://www.carrefoursa.com/search/?text=",
    marketKarsilastir: "https://marketkarsilastir.com/ara/",
};

const parsers = {
    trendyol: ($) => {
        if ($(".srch-rslt-title .srch-ttl-cntnr-wrppr h2").text().includes("bulunamadi")) {
            return false;
        }
        return $(".prdct-cntnr-wrppr .p-card-wrppr").get().map((el) => {
            const productImgSrc = $(el).find(".p-card-img-wr:first-child .p-card-img:first-child").attr("src") || "";
            const productTitle = $(el).find(".prdct-desc-cntnr-ttl-w").text().trim() + " " + $(el).find(".prdct-desc-cntnr-name").text().trim() || "";
            const productPrice = $(el).find(".price-information .price-item").text().trim() || "";
            return { productImgSrc, productTitle, productPrice };
        });
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
        return false;
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
    try {
        return JSON.parse(fs.readFileSync(productListPath));
    } catch {
        return [];
    }
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
    let notFoundList = [];
    if (fs.existsSync(notFoundPath)) {
        try {
            notFoundList = JSON.parse(fs.readFileSync(notFoundPath, "utf-8"));
        } catch {
            notFoundList = [];
        }
    }
    if (!notFoundList.includes(barcode)) {
        notFoundList.push(barcode);
        ensureDirForFile(notFoundPath);
        fs.writeFileSync(notFoundPath, JSON.stringify(notFoundList, null, 2));
    }
}

async function fetchBarcode(barcode, pages) {
    const marketEntries = Object.entries(pages);
    let done = false;
    let completedCount = 0;

    return new Promise((resolve) => {
        const finish = (result) => {
            if (done) return;
            done = true;
            resolve(result);
        };

        for (const [marketName, page] of marketEntries) {
            (async () => {
                try {
                    const url = webList[marketName] + barcode;
                    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

                    if (done) return;

                    const content = await page.content();
                    const $ = cheerio.load(content);
                    const productListArray = parsers[marketName]($);

                    if (productListArray && productListArray.length && productListArray[0].productPrice) {
                        productListArray[0].productPrice = normalizePrice(productListArray[0].productPrice);
                        const result = {
                            success: true,
                            site: marketName,
                            barcode,
                            productList: [productListArray[0]],
                        };
                        addProductList(result);
                        console.log(`[OK] ${marketName} -> ${barcode}`);
                        finish(result);
                    }
                } catch (err) {
                    if (!done) console.warn(`[WARN] ${marketName} hatasi: ${err.message}`);
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

async function fetchBarcodes(barcodes, browser) {
    const existingBarcodes = new Set(loadProductList().map(p => String(p.barcode)));
    const toFetch = barcodes.filter(b => !existingBarcodes.has(String(b)));

    if (toFetch.length < barcodes.length) {
        console.log(`[SKIP] ${barcodes.length - toFetch.length} barkod zaten mevcut, atlandi.`);
    }
    if (toFetch.length === 0) {
        console.log("[DONE] Tum barkodlar zaten kayitli.");
        return [];
    }

    const pages = {};
    for (const marketName of Object.keys(webList)) {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        pages[marketName] = page;
    }
    console.log(`[START] ${Object.keys(pages).length} tab acildi. ${toFetch.length} barkod islenecek.`);

    const results = [];
    for (let i = 0; i < toFetch.length; i++) {
        console.log(`[${i + 1}/${toFetch.length}] -> ${toFetch[i]}`);
        results.push(await fetchBarcode(toFetch[i], pages));
    }

    for (const page of Object.values(pages)) {
        await page.close().catch(() => {});
    }

    return results;
}

module.exports = { fetchBarcodes };

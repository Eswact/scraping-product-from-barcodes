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

const baseUrls = {
    trendyol:   "https://www.trendyol.com",
    hepsiburada:"https://www.hepsiburada.com",
    pazarama:   "https://www.pazarama.com",
    mopas:      "https://www.mopas.com.tr",
    aftaMarket: "https://www.aftamarket.com.tr",
    carrefour:  "https://www.carrefoursa.com",
    sokMarket:  "https://www.sokmarket.com.tr",
};

function resolveUrl(marketName, href) {
    if (!href) return null;
    if (href.startsWith("http")) return href;
    return (baseUrls[marketName] || "") + href;
}

const parsers = {
    trendyol: ($) => {
        if ($(".did-you-mean .information-banner .information-text").text().includes("bulunamadı")) return false;
        if ($(".search-result-content .product-card").get().length === 0) return false;
        return $(".search-result-content .product-card").get().map((el) => ({
            productImgSrc: $(el).find(".image-wrapper:first-child .image-slider:first-child img:first-child").attr("src") || "",
            productTitle: $(el).find(".brand-name-wrapper .product-brand").text().trim() + " " + $(el).find(".brand-name-wrapper .product-name").text().trim(),
            productPrice: $(el).find(".single-price .price-section").text().trim() || "",
            productUrl: $(el).attr("href") || $(el).find("a").first().attr("href") || "",
        }));
    },
    hepsiburada: ($) => {
        const firstItem = $("li#i0");
        if (firstItem.length === 0) return false;
        return [{
            productImgSrc: firstItem.find("picture img").attr("src") || "",
            productTitle: firstItem.find('[data-test-id^="title-"] a').text().trim() || "",
            productPrice: firstItem.find('[data-test-id^="final-price-"]').text().trim() || "",
            productUrl: firstItem.find('a').attr("href") || "",
        }];
    },
    pazarama: ($) => {
        if ($(".product-card").get().length > 1) return false;
        return $(".product-card").get().map((el) => ({
            productImgSrc: $(el).find("picture img:first-child").attr("src") || "",
            productTitle: $(el).find("[data-testid='product-card-title']").text().trim() || "",
            productPrice: $(el).find(".product-card__price .leading-tight").last().text().trim() || "",
            productUrl: $(el).find("a").first().attr("href") || "",
        }));
    },
    mopas: ($) => {
        if ($(".product-list-grid .card").get().length > 1) return false;
        return $(".product-list-grid .card").get().map((el) => ({
            productImgSrc: $(el).find("img").attr("src") || "",
            productTitle: $(el).find(".product-title").text().trim() || "",
            productPrice: $(el).find(".sale-price").text().trim() || "",
            productUrl: $(el).find("a").first().attr("href") || "",
        }));
    },
    aftaMarket: ($) => {
        if ($(".catalogWrapper .productItem").get().length > 1) return false;
        return $(".catalogWrapper .productItem").get().map((el) => ({
            productImgSrc: $(el).find(".stImage").data("src") || "",
            productTitle: $(el).find(".vitrin-urun-adi").text().trim() || "",
            productPrice: $(el).find(".productPrice .currentPrice").text().trim() || "",
            productUrl: $(el).find("a.detailLink").first().attr("href") || "",
        }));
    },
    carrefour: ($) => {
        if ($(".product-listing .product-listing-item .hover-box").get().length > 1) return false;
        return $(".product-listing .product-listing-item .hover-box").get().map((el) => ({
            productImgSrc: $(el).find("img").attr("src") || "",
            productTitle: $(el).find(".item-name").text().trim() || "",
            productPrice: $(el).find(".item-price").attr("content") || "",
            productUrl: $(el).find("a.product-return").first().attr("href") || "",
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
            const productUrl = $(el).closest("a").attr("href") || $(el).find("a").first().attr("href") || "";
            return { productImgSrc, productTitle, productPrice, productUrl };
        });
    },
    marketKarsilastir: ($) => {
        const cards = $(".product-card").get();
        if (cards.length === 0) return false;
        return cards.slice(0, 1).map((el) => {
            const productImgSrc = $(el).find(".product-image").attr("src") || "";
            const productTitle = $(el).find(".product-name").text().trim() || "";
            const productPrice = $(el).find(".product-price-badge").clone().children("small").remove().end().text().trim() || "";
            const _cat = $(el).find(".product-category").text().trim();
            const categoryPath = _cat ? [_cat] : [];
            return { productImgSrc, productTitle, productPrice, categoryPath };
        });
    },
};

const breadcrumbWaitSelectors = {
    trendyol:    "#breadcrumb-context ul.breadcrumb",
    hepsiburada: '[data-test-id="breadcrumb-last-item"]',
    pazarama:    '[data-testid="base-breadcrumb-link"]',
    mopas:       ".container-fluid.breadcrumb",
    aftaMarket:  "#navigasyon ul.breadcrumb",
    carrefour:   'script[type="application/ld+json"]',
    sokMarket:   '[class*="Breadcrumb_breadcrumbs"]',
};

const breadcrumbParsers = {
    trendyol: ($) => {
        const items = [];
        $("#breadcrumb-context ul.breadcrumb li a").each((_, el) => {
            const text = $(el).text().trim();
            if (text && text !== "Trendyol") items.push(text);
        });
        return items;
    },
    hepsiburada: ($) => {
        const lastItem = $('[data-test-id="breadcrumb-last-item"]');
        if (!lastItem.length) return [];
        const items = [];
        lastItem.closest("ul").find("li a").each((_, el) => {
            const text = $(el).text().trim();
            if (text && text !== "Anasayfa") items.push(text);
        });
        return items;
    },
    pazarama: ($) => {
        const items = [];
        $('[data-testid="base-breadcrumb-link"]').each((_, el) => {
            const text = $(el).text().trim();
            if (text && text !== "Anasayfa") items.push(text);
        });
        return items;
    },
    mopas: ($) => {
        const items = [];
        $(".container-fluid.breadcrumb ol li a span").each((_, el) => {
            const text = $(el).text().trim();
            if (text && text !== "Mopaş Kategoriler") items.push(text);
        });
        return items;
    },
    aftaMarket: ($) => {
        const items = [];
        $("#navigasyon ul.breadcrumb li a").each((_, el) => {
            const title = $(el).attr("title");
            if (title && title !== "Anasayfa") items.push(title);
        });
        return items;
    },
    carrefour: ($) => {
        try {
            const scriptEl = $('script[type="application/ld+json"]').filter((_, el) => $(el).html().includes('"BreadcrumbList"'));
            if (!scriptEl.length) return [];
            const data = JSON.parse(scriptEl.first().html());
            return (data.itemListElement || [])
                .slice(1, -1)
                .map(item => item.name);
        } catch {
            return [];
        }
    },
    sokMarket: ($) => {
        const items = [];
        $('[class*="Breadcrumb_breadcrumbs"] a').each((_, el) => {
            const text = $(el).text().trim();
            // if (text) items.push(text);
            if (text && text !== "Market") items.push(text);
        });
        return items;
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

const PAGE_RESTART_INTERVAL = 500;
const DETACHED_FRAME_PATTERN = /detached frame/i;

async function createPages(browser) {
    const pages = {};
    for (const marketName of Object.keys(webList)) {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        pages[marketName] = page;
    }
    return pages;
}

async function recreatePage(browser, pages, marketName) {
    try { await pages[marketName].close(); } catch {}
    const newPage = await browser.newPage();
    await newPage.setUserAgent(USER_AGENT);
    pages[marketName] = newPage;
    return newPage;
}

async function restartAllPages(browser, pages) {
    for (const marketName of Object.keys(pages)) {
        try { await pages[marketName].close(); } catch {}
    }
    const fresh = await createPages(browser);
    for (const marketName of Object.keys(fresh)) {
        pages[marketName] = fresh[marketName];
    }
    console.log("[RESTART] Tum sayfalar yeniden olusturuldu.");
}

async function doFetchForMarket(page, marketName, barcode, winner, pages, browser) {
    await page.goto(webList[marketName](barcode), { waitUntil: "domcontentloaded", timeout: 15000 });
    if (winner.value) return;
    const $ = cheerio.load(await page.content());
    const items = parsers[marketName]($);
    if (items && items.length && items[0].productPrice) {
        items[0].productPrice = normalizePrice(items[0].productPrice);

        let categoryPath = items[0].categoryPath || [];
        const rawUrl = items[0].productUrl;
        delete items[0].productUrl;

        if (rawUrl && breadcrumbParsers[marketName] && !winner.value) {
            const productUrl = resolveUrl(marketName, rawUrl);
            if (productUrl) {
                try {
                    await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
                    const waitSel = breadcrumbWaitSelectors[marketName];
                    if (waitSel) {
                        try { await page.waitForSelector(waitSel, { timeout: 6000 }); } catch {}
                    }
                    const $detail = cheerio.load(await page.content());
                    categoryPath = breadcrumbParsers[marketName]($detail) || [];
                } catch {}
            }
        }

        if (!winner.value) {
            winner.value = { success: true, site: marketName, barcode, product: { ...items[0], categoryPath } };
            addProductList(winner.value);
            console.log(`[OK] ${marketName} -> ${barcode}`);
        }
    }
}

async function fetchBarcode(barcode, pages, browser) {
    const marketEntries = Object.entries(pages);
    const winner = { value: null };

    await Promise.allSettled(marketEntries.map(async ([marketName, page]) => {
        try {
            await doFetchForMarket(page, marketName, barcode, winner, pages, browser);
        } catch (err) {
            if (DETACHED_FRAME_PATTERN.test(err.message) && browser) {
                try {
                    const newPage = await recreatePage(browser, pages, marketName);
                    await doFetchForMarket(newPage, marketName, barcode, winner, pages, browser);
                } catch (retryErr) {
                    if (!winner.value) console.warn(`[WARN] ${marketName}: ${retryErr.message}`);
                }
            } else {
                if (!winner.value) console.warn(`[WARN] ${marketName}: ${err.message}`);
            }
        }
    }));

    if (!winner.value) {
        winner.value = { success: false, barcode, message: "Urun bulunamadi" };
        addNotFoundBarcode(barcode);
        console.log(`[NOT FOUND] ${barcode}`);
    }

    return winner.value;
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
        pages = await createPages(browser);
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

            if (fetchCount % PAGE_RESTART_INTERVAL === 0) {
                await restartAllPages(browser, pages);
            }

            result = await fetchBarcode(barcode, pages, browser);
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

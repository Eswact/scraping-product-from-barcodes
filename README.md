# Barcode Product Scraper

Barkod listesinden Türk e-ticaret sitelerini tarayarak ürün bilgisi (isim, fiyat, kategori, görsel) toplayan Node.js uygulaması.

## Desteklenen Siteler

Trendyol, Hepsiburada, Pazarama, Mopas, AftaMarket, Carrefoursa, ŞokMarket, MarketKarşılaştır

## Kurulum

```bash
npm install
```

## Kullanım

### 1. Sunucuyu Başlat

```bash
npm start
```

### 2. Barkodları Tara

`input/barcodes.json` dosyasına barkod listesi koy:

```json
["8690637812309", "8690559005353"]
```

Ardından çalıştır:

```bash
npm run run-barcodes
```

### 3. Görselleri İndir

```bash
npm run download
```

### 4. CSV'ye Dönüştür

```bash
npm run to-csv
```

## Çıktı

| Dosya | Açıklama |
|---|---|
| `output/product-list.json` | Ham tarama sonuçları |
| `output/updated-product-list.json` | Görsel yolları güncellenmiş liste |
| `output/product-list.csv` | CSV formatı |
| `output/images/` | İndirilen ürün görselleri |
| `output/not-found-barcodes.json` | Bulunamayan barkodlar |

## Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `SCRAPER_WORKERS` | `1` | Paralel worker sayısı |
| `BROWSER_RESTART_INTERVAL` | `1000` | Her N barkodda tarayıcıyı yeniden başlat |
| `DOWNLOAD_CONCURRENCY` | `10` | Paralel görsel indirme sayısı |

## API

**POST** `/api/get-products` — Barkod listesi gönder, sonuçları bekle.

**POST** `/api/search` — SSE (Server-Sent Events) ile gerçek zamanlı sonuçlar al.

```json
{ "barcodes": ["8690637812309"] }
```

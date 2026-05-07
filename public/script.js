const API_URL = '/api/search';

const marketConfig = {
    trendyol:        { name: 'Trendyol',          logo: 'images/trendyol.png' },
    hepsiburada:     { name: 'Hepsiburada',        logo: 'images/hepsiburada.png' },
    pazarama:        { name: 'Pazarama',           logo: 'images/pazarama.png' },
    mopas:           { name: 'Mopaş',              logo: 'images/mopas.png' },
    aftaMarket:      { name: 'Afta Market',        logo: 'images/afta.png' },
    carrefour:       { name: 'CarrefourSA',        logo: 'images/carrefour.png' },
    sokMarket:         { name: 'Şok Market',         logo: 'images/sok.png' },
    marketKarsilastir: { name: 'Market Karşılaştır', logo: 'images/marketkarsilastir.png' },
};

function parseBarcodes(text) {
    return text.split(/[\n,]/).map(b => b.trim()).filter(b => b.length > 0);
}

function ensureSearchingCard(barcode, container) {
    if (document.getElementById(`result-card-${barcode}`)) return;
    container.insertAdjacentHTML('beforeend', `
        <div class="result-card result-card--searching" id="result-card-${barcode}">
            <div class="result-card-header">
                <div class="result-card-left">
                    <div class="result-status-icon result-status-icon--searching">
                        <span class="material-symbols-outlined">bolt</span>
                    </div>
                    <span class="result-barcode-number">${barcode}</span>
                    <span class="result-badge badge-searching">Aranıyor...</span>
                </div>
            </div>
        </div>
    `);
}

function resolveCard(result) {
    const card = document.getElementById(`result-card-${result.barcode}`);
    if (!card) return;

    card.classList.remove('result-card--searching');

    if (result.success) {
        const product = result.productList?.[0] || {};
        const market = marketConfig[result.site] || { name: result.site, logo: null };

        const imgHtml = product.productImgSrc
            ? `<img class="product-img" src="${product.productImgSrc}" alt="" onerror="this.replaceWith(document.createElement('div')); this.className='product-img-placeholder';">`
            : `<div class="product-img-placeholder"><span class="material-symbols-outlined">image_not_supported</span></div>`;

        const logoHtml = market.logo
            ? `<img src="${market.logo}" class="market-logo" alt="${market.name}">`
            : '';

        card.classList.add('result-card--success');
        card.innerHTML = `
            <div class="result-card-header">
                <div class="result-card-left">
                    <div class="result-status-icon result-status-icon--success">
                        <span class="material-symbols-outlined">check_circle</span>
                    </div>
                    <span class="result-barcode-number">${result.barcode}</span>
                    <span class="result-badge badge-success">Bulundu</span>
                </div>
            </div>
            <div class="product-detail">
                ${imgHtml}
                <div class="product-info">
                    <div class="product-market">
                        ${logoHtml}
                        <span class="market-name">${market.name}</span>
                    </div>
                    <div class="product-title">${product.productTitle || '—'}</div>
                    <div class="product-price">${product.productPrice ? '₺' + product.productPrice : '—'}</div>
                </div>
            </div>
        `;
    } else {
        card.classList.add('result-card--not-found');
        card.innerHTML = `
            <div class="result-card-header">
                <div class="result-card-left">
                    <div class="result-status-icon result-status-icon--not-found">
                        <span class="material-symbols-outlined">cancel</span>
                    </div>
                    <span class="result-barcode-number">${result.barcode}</span>
                    <span class="result-badge badge-not-found">Bulunamadı</span>
                </div>
            </div>
        `;
    }
}

async function searchBarcodes() {
    const input = document.getElementById('barcodeInput').value;
    const barcodes = parseBarcodes(input);

    if (barcodes.length === 0) {
        alert('Lütfen en az bir barkod numarası girin!');
        return;
    }

    const loadingDiv   = document.getElementById('loading');
    const resultsDiv   = document.getElementById('liveResults');
    const searchBtn    = document.querySelector('.btn-search');
    const clearBtn     = document.querySelector('.btn-clear');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    loadingDiv.classList.add('active');
    progressFill.style.width = '0%';
    progressText.textContent = `${barcodes.length} barkod aranıyor...`;

    resultsDiv.innerHTML = '';
    searchBtn.disabled = true;
    clearBtn.disabled = true;

    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';

    const statusChip  = document.getElementById('statusChip');
    const statusLabel = document.getElementById('statusLabel');
    statusChip.className = 'status-chip searching';
    statusLabel.textContent = 'Aranıyor...';

    window.exportData = [];
    barcodes.forEach(b => ensureSearchingCard(b, resultsDiv));
    resultsDiv.classList.add('active');

    let completed = 0;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcodes })
        });

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                let data;
                try { data = JSON.parse(line.slice(6)); } catch { continue; }

                if (data.type === 'result') {
                    resolveCard(data);
                    window.exportData.push(data);
                    completed++;
                    progressFill.style.width = Math.round((completed / barcodes.length) * 100) + '%';
                    progressText.textContent  = `${completed}/${barcodes.length} barkod tamamlandı`;
                    document.getElementById('resultsCount').textContent = `${completed} / ${barcodes.length} barkod tamamlandı`;
                }

                if (data.type === 'complete') {
                    loadingDiv.classList.remove('active');
                    displaySummary(window.exportData, resultsDiv);
                    statusChip.className  = 'status-chip done';
                    statusLabel.textContent = 'Tamamlandı';
                }

                if (data.type === 'error') throw new Error(data.message || 'Bilinmeyen hata');
            }
        }
    } catch (error) {
        resultsDiv.innerHTML = `
            <div class="error">
                <strong>Hata:</strong> ${error.message}
                <br><br>
                Sunucunun çalıştığından emin olun: <code>npm start</code>
            </div>
        `;
        resultsDiv.classList.add('active');
        loadingDiv.classList.remove('active');
        statusChip.className  = 'status-chip';
        statusLabel.textContent = 'Hata';
    } finally {
        searchBtn.disabled = false;
        clearBtn.disabled  = false;
    }
}

function displaySummary(results, container) {
    if (document.querySelector('.summary-section')) return;

    const found    = results.filter(r => r.success).length;
    const notFound = results.filter(r => !r.success).length;

    const rows = results.map(r => {
        if (r.success) {
            const product = r.productList?.[0] || {};
            const market  = marketConfig[r.site] || { name: r.site, logo: null };
            const logoHtml = market.logo ? `<img src="${market.logo}" class="summary-market-logo" alt="">` : '';
            return `
                <tr>
                    <td class="summary-barcode">${r.barcode}</td>
                    <td>
                        <div class="summary-market-cell">
                            ${logoHtml}
                            <span class="summary-market-name">${market.name}</span>
                        </div>
                    </td>
                    <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${product.productTitle || '—'}</td>
                    <td class="summary-lowest">${product.productPrice ? '₺' + product.productPrice : '—'}</td>
                    <td><span class="status-badge status-success">Bulundu</span></td>
                </tr>`;
        }
        return `
            <tr>
                <td class="summary-barcode">${r.barcode}</td>
                <td colspan="3">—</td>
                <td><span class="status-badge status-not-found">Bulunamadı</span></td>
            </tr>`;
    }).join('');

    container.insertAdjacentHTML('beforeend', `
        <div class="summary-section">
            <div class="summary-section-header">
                <h3 class="summary-section-title">Özet — ${found} bulundu, ${notFound} bulunamadı</h3>
                <button class="btn-export" onclick="exportToExcel()">
                    <span class="material-symbols-outlined">download</span>
                    CSV İndir
                </button>
            </div>
            <div class="summary-table-wrapper">
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Barkod</th>
                            <th>Platform</th>
                            <th>Ürün Adı</th>
                            <th>Fiyat</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `);
}

function exportToExcel() {
    const data = window.exportData || [];
    if (data.length === 0) { alert('Henüz veri yok!'); return; }

    const escape = v => { const s = String(v ?? ''); return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s; };

    let csv = 'Barkod,Platform,Ürün Adı,Fiyat\n';
    data.forEach(r => {
        if (r.success) {
            const p = r.productList?.[0] || {};
            const market = marketConfig[r.site]?.name || r.site;
            csv += [r.barcode, market, p.productTitle || '', p.productPrice || ''].map(escape).join(',') + '\n';
        } else {
            csv += [r.barcode, 'Bulunamadı', '', ''].map(escape).join(',') + '\n';
        }
    });

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `barkod_sonuclar_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function clearAll() {
    document.getElementById('barcodeInput').value = '';
    document.getElementById('liveResults').innerHTML = '';
    document.getElementById('liveResults').classList.remove('active');
    document.getElementById('loading').classList.remove('active');
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('emptyState').style.display = 'flex';
    const chip = document.getElementById('statusChip');
    chip.className = 'status-chip';
    document.getElementById('statusLabel').textContent = 'Bekleniyor';
    window.exportData = [];
}

document.getElementById('barcodeInput').addEventListener('keypress', function (e) {
    if (e.ctrlKey && e.key === 'Enter') searchBarcodes();
});

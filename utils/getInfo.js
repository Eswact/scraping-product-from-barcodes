const fs = require('fs');
const path = require('path');

const founded = require('../datas/json/product-list.json');
const updatedFounded = require('../datas/json/updated-product-list.json');
const notFounded = require('../datas/json/notfound-barcodes.json');
const imagesDir = "./datas/images";

console.log("FROM TAMSOFT", founded.filter(x => x.site == "tamsoft").length);
console.log("FROM SCRAPİNG", (founded.length - (founded.filter(x => x.site == "tamsoft").length)));

console.log("HAVE IMAGE LINK", updatedFounded.filter(x => x.productList?.length > 0).length);
console.log("TOTAL FOUND", founded.length);
console.log("TOTAL NOT FOUND", notFounded.length);

fs.readdir(imagesDir, (err, files) => {
    if (err) {
        console.error(`❌ Klasör okunamadı: ${err}`);
        return;
    }
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const imageFiles = files.filter(file => 
        imageExtensions.includes(path.extname(file).toLowerCase())
    );

    console.log(`📸 DOWNLOADED IMAGES:`, imageFiles.length);
});
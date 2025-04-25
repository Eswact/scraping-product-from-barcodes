const fs = require("fs");
const path = require("path");
const productList = require('../datas/json/product-list.json');

const updatedProductListPath = "datas/json/updated-product-list.json";
const updatedProductList = []

productList.forEach((product) => {
    if (!Array.isArray(product.barcode)) {
        let tempProduct = product;
        if(tempProduct.productList && tempProduct.productList[0].productImgSrc) {
            tempProduct.productList[0].productImgSrc = `images/${tempProduct.barcode}.jpg`;
        }
        updatedProductList.push(tempProduct);
    }
    else {
        let tempProduct = product;
        if(tempProduct.productList) {
            let tempProductName = tempProduct.productList[0].productTitle;
            tempProduct.productList = [];
            tempProduct.barcode.forEach((b) => {
                tempProduct.productList.push({
                    productTitle: tempProductName,
                    productImgSrc: `images/${b}.jpg`
                });
            });
        }
        updatedProductList.push(tempProduct);
    }
});

fs.writeFileSync(updatedProductListPath, JSON.stringify(updatedProductList, null, 2));
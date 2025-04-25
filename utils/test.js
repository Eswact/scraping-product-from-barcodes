const fs = require("fs");
const path = require("path");
const productList = require('../datas/json/product-list.json');

const updatedProductListPath = "datas/json/test.json";
const updatedProductList = []

productList.forEach((product) => {
    if (product.site == "sarperMarket") {
        updatedProductList.push(product);
    }
});

fs.writeFileSync(updatedProductListPath, JSON.stringify(updatedProductList, null, 2));
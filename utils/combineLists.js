const fs = require("fs");
const path = require("path");

const MAIN_LIST = "./datas/json/updated-product-list.json";
const OTHER_LIST = "./datas/json/updated-product-list-new.json";
const REPEATED_LIST = "./datas/json/repeated-barcodes-2.json";

let mainList = JSON.parse(fs.readFileSync(MAIN_LIST, "utf-8"));
let otherList = JSON.parse(fs.readFileSync(OTHER_LIST, "utf-8"));
let repeatedList = [];

const existingBarcodes = [];
mainList.forEach((item) => {
  if (Array.isArray(item.barcode)) {
    existingBarcodes.push(...item.barcode);
  } else {
    existingBarcodes.push(item.barcode);
  }
});

otherList.map(function(item) {
    const alreadyExists = existingBarcodes.find(mainItem => mainItem.barcode === item.barcode);
    if (alreadyExists) {
        repeatedList.push(item.barcode);
    }
    else {
        mainList.push(item);
    }
});

fs.writeFileSync(REPEATED_LIST, JSON.stringify(repeatedList, null, 2));
fs.writeFileSync(MAIN_LIST, JSON.stringify(mainList, null, 2));
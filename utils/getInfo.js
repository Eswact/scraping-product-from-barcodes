const foundedOld = require('../datas/json/product-list.json');
const foundedNew = require('../datas/json/product-list-new.json');
const updatedFounded = require('../datas/json/updated-product-list.json');
const notFounded = require('../datas/json/notfound-barcodes.json');
const willBeSearch = require('../datas/json/will-be-search.json');


console.log("founded old", foundedOld.length);
console.log("from tamsoft", foundedOld.filter(x => x.site == "tamsoft").length);
console.log("updatedFounded", updatedFounded.length);
console.log("founded new", foundedNew.length);
// console.log("founded new new", foundedNew.filter(x => x.site == "trendyol" || x.site == "hepsiburada" || x.site == "onurMarket" || x.site == "pazarama").length);
console.log("notFounded", notFounded.length);
console.log("willBeSearch", willBeSearch.length);

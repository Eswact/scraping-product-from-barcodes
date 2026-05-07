const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");

const inputDir = () => path.join(PROJECT_ROOT, "input");
const outputDir = () => path.join(PROJECT_ROOT, "output");
const inputPath = (filename) => path.join(inputDir(), filename);
const outputPath = (filename) => path.join(outputDir(), filename);

function ensureDirForFile(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureOutputDir() {
    fs.mkdirSync(outputDir(), { recursive: true });
    fs.mkdirSync(path.join(outputDir(), "images"), { recursive: true });
}

module.exports = {
    PROJECT_ROOT,
    inputDir,
    outputDir,
    inputPath,
    outputPath,
    ensureDirForFile,
    ensureOutputDir,
};

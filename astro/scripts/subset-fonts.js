import Fontmin from 'fontmin';
import { globSync } from 'glob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extract all Chinese characters from source files
function extractChineseChars() {
  const files = [
    ...globSync('src/**/*.{ts,tsx,astro,js,jsx}', { cwd: path.join(__dirname, '..') }),
  ];

  const chineseChars = new Set();
  
  files.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Match all CJK Unified Ideographs and related blocks, plus fullwidth punctuation
    const matches = content.match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uFF01\uFF1A\uFF1F\uFF08\uFF09\u3001\u3002\uFF0C\u300C\u300D\u3008\u3009\uFF3B\uFF1B]/g);
    if (matches) {
      matches.forEach(char => chineseChars.add(char));
    }
  });

  return Array.from(chineseChars).sort().join('');
}

// Subset the fonts
function subsetFonts() {
  const chineseText = extractChineseChars();
  
  if (!chineseText) {
    console.log('No Chinese characters found. Skipping font subsetting.');
    return;
  }

  console.log(`Found ${chineseText.length} unique Chinese characters`);
  console.log('Subsetting fonts...');

  const fontsDir = path.join(__dirname, '..', 'public', 'fonts');
  const originalFonts = ['GenWanMin.otf', 'GenSenRounded.otf'];

  originalFonts.forEach(fontFile => {
    const fontPath = path.join(fontsDir, fontFile);
    
    if (!fs.existsSync(fontPath)) {
      console.log(`Font not found: ${fontFile}`);
      return;
    }

    // Create backup of original font if it doesn't exist
    const backupPath = path.join(fontsDir, `${fontFile}.original`);
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(fontPath, backupPath);
      console.log(`Backed up original: ${fontFile}.original`);
    }

    const fontmin = new Fontmin()
      .src(backupPath)
      .use(Fontmin.glyph({
        text: chineseText,
        hinting: false
      }))
      .dest(fontsDir);

    fontmin.run((err, files) => {
      if (err) {
        console.error(`Error subsetting ${fontFile}:`, err);
        return;
      }

      // Rename the output to replace the original
      const outputFile = path.join(fontsDir, `${fontFile}.original`);
      const targetFile = path.join(fontsDir, fontFile);
      
      if (fs.existsSync(outputFile)) {
        const stats = fs.statSync(outputFile);
        const backupStats = fs.statSync(backupPath);
        
        console.log(`${fontFile}: ${(backupStats.size / 1024 / 1024).toFixed(2)}MB → ${(stats.size / 1024).toFixed(2)}KB`);
        
        fs.copyFileSync(outputFile, targetFile);
      }
    });
  });
}

subsetFonts();

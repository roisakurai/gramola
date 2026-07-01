const fs = require("fs");

const INPUT_FILE = "words.txt";
const OUTPUT_FILE = "playlist-words.json";

const content = fs.readFileSync(INPUT_FILE, "utf8");

const words = [
  ...new Set(
    content
      .split(/\r?\n/)
      .map(w => w.trim())
      .filter(Boolean)
  )
];

const middle = Math.ceil(words.length / 2);

const result = {
  prefixes: words.slice(0, middle),
  suffixes: words.slice(middle)
};

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(result, null, 2),
  "utf8"
);

console.log(`Total kata: ${words.length}`);
console.log(`Prefixes: ${result.prefixes.length}`);
console.log(`Suffixes: ${result.suffixes.length}`);
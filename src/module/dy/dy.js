const path = require('path');
const fs = require('smart-fs');

const dir = path.join(__dirname, 'modules');

module.exports = fs.walkDir(dir).reduce((prev, cur) => {
  const fileName = cur.slice(0, -3);
  const fileNameParsed = fileName.replace(/(-[a-z])/, (l) => l.slice(-1).toUpperCase());
  // eslint-disable-next-line no-param-reassign
  prev[fileNameParsed] = fs.smartRead(path.join(dir, cur));
  return prev;
}, {});

const { join } = require("path");
const { sync: globSync, hasMagic } = require("glob");

const DEFAULT_PATTERN = "**/*.sol";

module.exports = (pattern) => {
  // pattern is either a directory (contracts directory), or an absolute path
  // with a glob expression
  if (!hasMagic(pattern)) {
    pattern = join(pattern, DEFAULT_PATTERN);
  }

  const globOptions = {
    follow: true, // follow symlinks
  };

  return globSync(pattern, globOptions);
};

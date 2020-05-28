const { isExplicitlyRelative } = require("./isExplicitlyRelative");
const Parser = require("../parser");
const { extname } = require("path");

const getImports = (file, { body, source }, solc, parserSolc) => {
  let imports;

  // No non-sol imports!
  if (extname(file) !== ".sol") return [];

  if (parserSolc) imports = Parser.parseImports(body, parserSolc);
  else imports = Parser.parseImports(body, solc);

  // Convert explicitly relative dependencies of modules back into module paths.
  return imports.map((dependencyPath) =>
    isExplicitlyRelative(dependencyPath)
      ? source.resolveDependencyPath(file, dependencyPath)
      : dependencyPath
  );
};

module.exports = {
  getImports,
};

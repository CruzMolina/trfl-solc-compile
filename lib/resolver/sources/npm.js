const { dirname, join } = require("path");
const { readFileSync } = require("fs");

class NPM {
  constructor(workingDirectory) {
    this.workingDirectory = workingDirectory;
  }

  async resolve(importPath) {
    // If nothing's found, body returns `undefined`
    var body;
    let modulesDir = this.workingDirectory;

    while (true) {
      const expectedPath = join(modulesDir, "node_modules", importPath);

      try {
        var body = readFileSync(expectedPath, { encoding: "utf8" });
        break;
      } catch (err) {}

      // Recurse outwards until impossible
      const oldModulesDir = modulesDir;
      modulesDir = join(modulesDir, "..");
      if (modulesDir === oldModulesDir) {
        break;
      }
    }
    return { body, filePath: importPath };
  }

  // We're resolving package paths to other package paths, not absolute paths.
  // This will ensure the source fetcher conintues to use the correct sources for packages.
  // i.e., if some_module/contracts/MyContract.sol imported "./AnotherContract.sol",
  // we're going to resolve it to some_module/contracts/AnotherContract.sol, ensuring
  // that when this path is evaluated this source is used again.
  resolveDependencyPath(importPath, dependencyPath) {
    const dirname = dirname(importPath);
    return join(dirname, dependencyPath);
  }
}

module.exports = NPM;

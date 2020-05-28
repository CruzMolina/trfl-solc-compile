const { basename, join, dirname, isAbsolute } = require("path");
const { readFileSync } = require("fs");
const { sync: detectInstalledSync } = require("detect-installed");
const { getInstalledPathSync } = require("get-installed-path");

class GlobalNPM {
  require(importPath) {
    if (importPath.indexOf(".") === 0 || isAbsolute(importPath)) {
      return null;
    }
    const contractName = basename(importPath, ".sol");

    let [packageName] = importPath.split("/", 1);
    if (detectInstalledSync(packageName)) {
      const regex = new RegExp(`/${packageName}$`);
      const globalPackagePath = getInstalledPathSync(packageName).replace(
        regex,
        ""
      );
      const expectedPath = join(
        globalPackagePath,
        packageName,
        "build",
        "contracts",
        `${contractName}.json`
      );
      try {
        const result = readFileSync(expectedPath, "utf8");
        return JSON.parse(result);
      } catch (e) {
        return null;
      }
    }
  }

  async resolve(importPath, _imported_from) {
    let [packageName] = importPath.split("/", 1);
    let body;
    if (detectInstalledSync(packageName)) {
      const regex = new RegExp(`/${packageName}$`);
      const globalPackagePath = getInstalledPathSync(packageName).replace(
        regex,
        ""
      );
      const expectedPath = join(globalPackagePath, importPath);
      try {
        body = readFileSync(expectedPath, { encoding: "utf8" });
      } catch (err) {}
    }

    // If nothing's found, body returns `undefined`
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

module.exports = GlobalNPM;

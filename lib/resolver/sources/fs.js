const {
  basename,
  normalize,
  isAbsolute,
  join,
  resolve,
  dirname,
} = require("path");
const { readFileSync, readdirSync } = require("fs");

class FS {
  constructor(workingDirectory, contractsBuildDirectory) {
    this.workingDirectory = workingDirectory;
    this.contractsBuildDirectory = contractsBuildDirectory;
  }

  async resolve(importPath, importedFrom = "") {
    const possiblePaths = [importPath, join(dirname(importedFrom), importPath)];

    let body;
    let filePath;
    possiblePaths.forEach((possiblePath) => {
      try {
        const resolvedSource = readFileSync(possiblePath, {
          encoding: "utf8",
        });
        body = resolvedSource;
        filePath = possiblePath;
      } catch (error) {
        // do nothing
      }
    });
    return { body, filePath };
  }

  // Here we're resolving from local files to local files, all absolute.
  resolveDependencyPath(importPath, dependencyPath) {
    const directoryName = dirname(importPath);
    return resolve(join(directoryName, dependencyPath));
  }
}

module.exports = FS;

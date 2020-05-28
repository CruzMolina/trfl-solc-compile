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

  require(importPath, searchPath = this.contractsBuildDirectory) {
    const normalizedImportPath = normalize(importPath);
    const contractName = this.getContractName(normalizedImportPath, searchPath);

    // If we have an absolute path, only check the file if it's a child of the workingDirectory.
    if (isAbsolute(normalizedImportPath)) {
      if (normalizedImportPath.indexOf(this.workingDirectory) !== 0) {
        return null;
      }
    }

    try {
      const result = readFileSync(
        join(searchPath, `${contractName}.json`),
        "utf8"
      );
      return JSON.parse(result);
    } catch (e) {
      return null;
    }
  }

  getContractName(sourcePath, searchPath = this.contractsBuildDirectory) {
    const contractsBuildDirFiles = readdirSync(searchPath);
    const filteredBuildArtifacts = contractsBuildDirFiles.filter(
      (file) => file.match(".json") != null
    );

    for (const buildArtifact of filteredBuildArtifacts) {
      const artifact = JSON.parse(
        readFileSync(resolve(searchPath, buildArtifact))
      );

      if (artifact.sourcePath === sourcePath) {
        return artifact.contractName;
      }
    }

    // fallback
    return basename(sourcePath, ".sol");
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

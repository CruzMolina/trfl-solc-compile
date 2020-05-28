// Compares .sol files to built json artifacts,
// determines which .sol files have been updated.

const { extname, isAbsolute, resolve, join } = require("path");
const CompilerSupplier = require("../compilerSupplier");
const findContracts = require("../../contract-sources");
const { valid: semverValid } = require("semver");
const { readAndParseArtifactFiles } = require("./readAndParseArtifactFiles");
const {
  minimumUpdatedTimePerSource,
} = require("./minimumUpdatedTimePerSource");
const { findUpdatedFiles } = require("./findUpdatedFiles");
const { isExplicitlyRelative } = require("./isExplicitlyRelative");
const { getImports } = require("./getImports");

module.exports = {
  async updated(truffleConfig) {
    const { contractsDirectory, contractsBuildDirectory } = truffleConfig;

    const getFiles = () => {
      if (truffleConfig.files) {
        return truffleConfig.files;
      } else {
        return findContracts(contractsDirectory);
      }
    };

    let sourceFilesArtifacts = {};
    let sourceFilesArtifactsUpdatedTimes = {};

    try {
      const sourceFiles = getFiles();
      sourceFilesArtifacts = readAndParseArtifactFiles(
        sourceFiles,
        contractsBuildDirectory
      );
      sourceFilesArtifactsUpdatedTimes = minimumUpdatedTimePerSource(
        sourceFilesArtifacts
      );
      const updatedFiles = findUpdatedFiles(
        sourceFilesArtifacts,
        sourceFilesArtifactsUpdatedTimes
      );
      return updatedFiles;
    } catch (error) {
      throw error;
    }
  },

  // Returns the minimal set of sources to pass to solc as compilations targets,
  // as well as the complete set of sources so solc can resolve the comp targets' imports.
  async requiredSources(truffleConfig) {
    const resolver = truffleConfig.resolver;
    let allPaths, updates;
    const allSources = {};
    const compilationTargets = [];
    // Fetch the whole contract set
    const sourcePaths = findContracts(truffleConfig.contractsDirectory);
    allPaths = sourcePaths;

    // Solidity test files might have been injected. Include them in the known set.
    truffleConfig.paths.forEach((_path) => {
      if (!allPaths.includes(_path)) {
        allPaths.push(_path);
      }
    });

    // Exit w/out minimizing if we've been asked to compile nothing
    if (!truffleConfig.paths.length) {
      return { allSources, required: compilationTargets };
    }
    updates = this.convertToAbsolutePaths(
      truffleConfig.paths,
      truffleConfig.contractsDirectory
    ).sort();
    allPaths = this.convertToAbsolutePaths(
      allPaths,
      truffleConfig.contractsDirectory
    ).sort();

    // Load compiler
    const supplierOptions = {
      parser: truffleConfig.parser,
      solcConfig: truffleConfig.compilers.solc,
      quiet: truffleConfig.quiet,
    };
    const supplier = new CompilerSupplier(supplierOptions);
    const { solc, parserSolc } = await supplier.load();
    // Get all the source code
    const resolved = await this.resolveAllSources(
      resolver,
      allPaths,
      solc,
      parserSolc
    );
    // Generate hash of all sources including external packages - passed to solc inputs.
    const resolvedPaths = Object.keys(resolved);
    resolvedPaths.forEach((file) => {
      // Only pass any .sol files to solc!
      if (extname(file) === ".sol") allSources[file] = resolved[file].body;
    });

    // Exit w/out minimizing if we've been asked to compile everything
    if (this.listsEqual(truffleConfig.paths, allPaths)) {
      return { allSources, required: compilationTargets };
    }

    // Seed compilationTargets with known updates
    updates.forEach((update) => compilationTargets.push(update));

    // While there are updated files in the queue, we take each one
    // and search the entire file corpus to find any sources that import it.
    // Those sources are added to list of compilation targets as well as
    // the update queue because their own ancestors need to be discovered.
    while (updates.length > 0) {
      const currentUpdate = updates.shift();
      const files = allPaths.slice();

      // While files: dequeue and inspect their imports
      while (files.length > 0) {
        const currentFile = files.shift();

        // Ignore targets already selected.
        if (compilationTargets.includes(currentFile)) {
          continue;
        }

        let imports;
        try {
          imports = await getImports(
            currentFile,
            resolved[currentFile],
            solc,
            parserSolc
          );
        } catch (err) {
          err.message = `Error parsing ${currentFile}: ${err.message}`;
          throw err;
        }

        // If file imports a compilation target, add it
        // to list of updates and compilation targets
        if (imports.includes(currentUpdate)) {
          updates.push(currentFile);
          compilationTargets.push(currentFile);
        }
      }
    }

    return { allSources, required: compilationTargets };
  },

  // Resolves sources in several async passes. For each resolved set it detects unknown
  // imports from external packages and adds them to the set of files to resolve.
  async resolveAllSources(resolver, initialPaths, solc, parserSolc) {
    const mapping = {};
    const allPaths = initialPaths.slice();

    // Begin generateMapping
    function generateMapping() {
      const promises = [];

      // Dequeue all the known paths, generating resolver promises,
      // We'll add paths if we discover external package imports.
      while (allPaths.length) {
        let file;
        let parent = undefined;

        const candidate = allPaths.shift();

        // Some paths will have been extracted as imports from a file
        // and have information about their parent location we need to track.
        if (typeof candidate === "object") {
          file = candidate.file;
          parent = candidate.parent;
        } else {
          file = candidate;
        }
        promises.push(resolver.resolve(file, parent));
      }

      // Resolve everything known and add it to the map, then inspect each file's
      // imports and add those to the list of paths to resolve if we don't have it.
      return Promise.all(promises).then(async (results) => {
        // Generate the sources mapping
        results.forEach(
          (item) => (mapping[item.filePath] = Object.assign({}, item))
        );

        // Queue unknown imports for the next resolver cycle
        while (results.length) {
          const result = results.shift();

          // Inspect the imports
          let imports;
          try {
            imports = await getImports(
              result.filePath,
              result,
              solc,
              parserSolc
            );
          } catch (err) {
            if (err.message.includes("requires different compiler version")) {
              const contractSolcPragma = err.message.match(
                /pragma solidity[^;]*/gm
              );

              // if there's a match provide the helpful error, otherwise return solc's error output
              if (contractSolcPragma) {
                const contractSolcVer = contractSolcPragma[0];
                const configSolcVer = semverValid(solc.version());
                err.message = err.message.concat(
                  `\n\nError: Truffle is currently using solc ${configSolcVer}, but one or more of your contracts specify "${contractSolcVer}".\nPlease update your truffle config or pragma statement(s).\n(See https://truffleframework.com/docs/truffle/reference/configuration#compiler-configuration for information on\nconfiguring Truffle to use a specific solc compiler version.)\n`
                );
              }
            }
            throw err;
          }

          // Detect unknown external packages / add them to the list of files to resolve
          // Keep track of location of this import because we need to report that.
          imports.forEach((item) => {
            if (!mapping[item])
              allPaths.push({ file: item, parent: result.filePath });
          });
        }
      });
    }
    // End generateMapping

    while (allPaths.length) {
      await generateMapping();
    }
    return mapping;
  },

  listsEqual(listA, listB) {
    const a = listA.sort();
    const b = listB.sort();

    return JSON.stringify(a) === JSON.stringify(b);
  },

  convertToAbsolutePaths(paths, base) {
    return paths.map((p) => {
      // If it's an absolute paths, leave it alone.
      if (isAbsolute(p)) return p;

      // If it's not explicitly relative, then leave it alone (i.e., it's a module).
      if (!isExplicitlyRelative(p)) return p;

      // Path must be explicitly relative, therefore make it absolute.
      return resolve(join(base, p));
    });
  },
};

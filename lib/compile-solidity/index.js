const { isAbsolute, sep, relative } = require("path");
const findContracts = require("../contract-sources");
const Config = require("../config");
const Profiler = require("./profiler");
const CompilerSupplier = require("./compilerSupplier");
const { run } = require("./run");
const { normalizeTruffleConfig } = require("./options");

// Most basic of the compile commands. Takes a hash of sources, where
// the keys are file or module paths and the values are the bodies of
// the contracts. Does not evaulate dependencies that aren't already given.
//
// Default truffleConfig options:
// {
//   strict: false,
//   quiet: false,
// }
const compile = async (sources, truffleConfig) =>
  await run(sources, normalizeTruffleConfig(truffleConfig));

// contractsDirectory: String. Directory where .sol files can be found.
// quiet: Boolean. Suppress output. Defaults to false.
// strict: Boolean. Return compiler warnings as errors. Defaults to false.
// files: Array<String>. Explicit files to compile besides detected sources
compile.all = async (truffleConfig) => {
  const paths = [
    ...new Set([
      ...findContracts(truffleConfig.contractsDirectory),
      ...(truffleConfig.files || []),
    ]),
  ];

  return await compile.withDependencies(truffleConfig.merge({ paths }));
};

// contractsDirectory: String. Directory where .sol files can be found.
// buildDirectory: String. Optional. Directory where .json files can be found. Only required if `all` is false.
// all: Boolean. Compile all sources found. Defaults to true. If false, will compare sources against built files
//      in the build directory to see what needs to be compiled.
// quiet: Boolean. Suppress output. Defaults to false.
// strict: Boolean. Return compiler warnings as errors. Defaults to false.
// files: Array<String>. Explicit files to compile besides detected sources
compile.necessary = async (truffleConfig) => {
  const paths = [
    ...new Set([
      ...(await Profiler.updated(truffleConfig)),
      ...(truffleConfig.files || []),
    ]),
  ];

  return await compile.withDependencies(truffleConfig.merge({ paths }));
};

compile.withDependencies = async (truffleConfig) => {
  let allSources, required;

  try {
    ({ allSources, required } = await Profiler.requiredSources(truffleConfig));
  } catch (error) {
    throw error;
  }

  const hasTargets = required.length;

  hasTargets
    ? compile.display(required, truffleConfig)
    : compile.display(allSources, truffleConfig);

  truffleConfig.compilationTargets = required;
  return compile(allSources, truffleConfig);
};

compile.display = (paths, { quiet, workingDirectory }) => {
  if (quiet !== true) {
    if (!Array.isArray(paths)) {
      paths = Object.keys(paths);
    }

    const blacklistRegex = /^truffle\//;

    paths.sort().forEach((contract) => {
      if (isAbsolute(contract)) {
        contract = `.${sep}${relative(workingDirectory, contract)}`;
      }
      if (contract.match(blacklistRegex)) return;
      console.log(`> Compiling ${contract}`);
    });
  }
};

compile.CompilerSupplier = CompilerSupplier;
module.exports = compile;

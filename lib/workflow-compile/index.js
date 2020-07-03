const ora = require("ora");
const { prepareConfig, byContractName, ensureDirSync } = require("./utils");
const { shimContract } = require("./shims");

const SUPPORTED_COMPILERS = {
  solc: {
    compiler: require("../compile-solidity"),
  },
};

const _compile = async (truffleConfig) => {
  // determine compiler(s) to use
  //

  const compilers = Object.keys(truffleConfig.compilers);

  // invoke compilers
  //

  const rawCompilations = await Promise.all(
    compilers.map(async (name) => {
      const { compiler } = SUPPORTED_COMPILERS[name] || {};
      if (!compiler) throw new Error("Unsupported compiler: " + name);

      const compile =
        truffleConfig.all === true || truffleConfig.compileAll === true
          ? compiler.all
          : compiler.necessary;

      return {
        [name]: await compile(truffleConfig),
      };
    })
  );

  // collect results
  //

  const compilations = rawCompilations.reduce(
    (a, b) => Object.assign({}, a, b),
    {}
  );

  const [compilerUsed] = Object.values(compilations)
    .map(({ compilerInfo }) => compilerInfo)
    .filter((compilerInfo) => compilerInfo);

  const contracts = Object.values(compilations)
    .map(({ contracts }) => contracts)
    .reduce((a, b) => [...a, ...b], []);

  return { contracts, compilations, compilerUsed };
};

const Contracts = {
  async compile(truffleConfig) {
    let contracts, compilations, compilerUsed;
    if (!truffleConfig.quiet) {
      console.log(`\nCompiling contracts...`);
      console.log(`===========================`);
    }

    try {
      ({ contracts, compilations, compilerUsed } = await _compile(
        truffleConfig
      ));
    } catch (error) {
      throw error;
    }

    /*if (compilerUsed) {
      truffleConfig.compilersInfo[compilerUsed.name] = {
        version: compilerUsed.version,
      };
    }*/

    if (!truffleConfig.quiet) {
      if (contracts.length === 0) {
        console.log(
          `> Everything is up to date, there is nothing to compile.\n`
        );
      } else {
        if (Object.keys(compilerUsed).length > 0) {
          console.log(
            `> Artifacts written to ${truffleConfig.contractsBuildDirectory}`
          );
          console.log(`> Compiled successfully using:`);

          const maxLength = Object.keys(compilerUsed)
            .map((name) => name.length)
            .reduce((max, length) => (length > max ? length : max), 0);

          const padding = " ".repeat(maxLength - compilerUsed.name.length);

          console.log(
            `   - ${compilerUsed.name}:${padding} ${compilerUsed.version}\n`
          );
        }
      }
    }

    return {
      contracts,
      compilations,
    };
  },

  prepareConfig,

  async save(truffleConfig, contracts) {
    await ensureDirSync(truffleConfig.contractsBuildDirectory);
    const artifacts = byContractName(contracts.map(shimContract));
    await truffleConfig.artifactor.saveAll(artifacts);
  },
};

module.exports = Contracts;

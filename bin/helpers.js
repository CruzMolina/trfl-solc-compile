const { join, resolve } = require("path");
const TruffleConfig = require("../lib/config");
const { prepareConfig, compile, save } = require("../lib/workflow-compile");

module.exports = {
  processParams: async (contractsLocation, yargArgs) => {
    const truffleConfig = TruffleConfig.detect(yargArgs);

    if (contractsLocation) {
      truffleConfig.contractsDirectory = resolve(
        process.cwd(),
        contractsLocation
      );
    }

    return truffleConfig;
  },
  processContracts: async (truffleConfig) => {
    const preparedConfig = prepareConfig(truffleConfig);
    const { contracts: compiledContracts } = await compile(preparedConfig);
    return save(preparedConfig, compiledContracts);
  },
};

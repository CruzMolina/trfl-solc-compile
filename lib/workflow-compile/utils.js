const Resolver = require("../resolver");
const Artifactor = require("../artifactor");

function prepareConfig(truffleConfig) {
  truffleConfig.compilersInfo = {};
  truffleConfig.resolver = new Resolver(truffleConfig);
  truffleConfig.artifactor = new Artifactor(
    truffleConfig.contractsBuildDirectory
  );
  return truffleConfig;
}

function byContractName(contracts) {
  return contracts
    .map((contract) => ({
      [contract.contractName || contract.contract_name]: contract,
    }))
    .reduce((a, b) => Object.assign({}, a, b), {});
}

module.exports = {
  prepareConfig,
  byContractName,
};

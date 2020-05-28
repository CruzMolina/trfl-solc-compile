/**
 * Handle truffleConfig compatibility
 */
module.exports = {
  normalizeTruffleConfig(truffleConfig) {
    truffleConfig.compilers.solc.settings.evmVersion =
      truffleConfig.compilers.solc.settings.evmVersion ||
      truffleConfig.compilers.solc.evmVersion;
    truffleConfig.compilers.solc.settings.optimizer =
      truffleConfig.compilers.solc.settings.optimizer ||
      truffleConfig.compilers.solc.optimizer ||
      {};

    // Grandfather in old solc config
    if (truffleConfig.solc) {
      truffleConfig.compilers.solc.settings.evmVersion =
        truffleConfig.solc.evmVersion;
      truffleConfig.compilers.solc.settings.optimizer =
        truffleConfig.solc.optimizer;
    }

    // Certain situations result in `{}` as a value for compilationTargets
    // Previous implementations treated any value lacking `.length` as equivalent
    // to `[]`
    if (
      !truffleConfig.compilationTargets ||
      !truffleConfig.compilationTargets.length
    ) {
      truffleConfig.compilationTargets = [];
    }

    return truffleConfig;
  },
};

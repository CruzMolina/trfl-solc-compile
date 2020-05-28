const { resolve, join } = require("path");

// This is a list of multi-level keys with defaults
// we need to _.merge. Using this list for safety
// vs. just merging all objects.
const _values = () => {
  return {
    truffleDirectory: resolve(join(__dirname, "../")),
    workingDirectory: process.cwd(),
    resolver: null,
    artifactor: null,
    compilers: {
      solc: {
        settings: {
          optimizer: {
            enabled: false,
            runs: 200,
          },
          remappings: [],
        },
      },
    },
  };
};

const configProps = ({ configObject }) => {
  const resolveDirectory = (value) => {
    return resolve(configObject.workingDirectory, value);
  };

  return {
    // These are already set.
    truffleDirectory() {},
    workingDirectory() {},
    resolver() {},
    artifactor() {},
    compilers() {},
    buildDirectory: {
      default: () => join(configObject.workingDirectory, "build"),
      transform: resolveDirectory,
    },
    contractsDirectory: {
      default: () => join(configObject.workingDirectory, "contracts"),
      transform: resolveDirectory,
    },
    contractsBuildDirectory: {
      default: () => join(configObject.buildDirectory, "contracts"),
      transform: resolveDirectory,
    },
  };
};

module.exports = {
  _values,
  configProps,
};

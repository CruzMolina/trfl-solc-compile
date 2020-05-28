const NPMSource = require("./npm");
const GlobalNPMSource = require("./globalnpm");
const FSSource = require("./fs");

module.exports = (truffleConfig) => {
  return [
    new FSSource(
      truffleConfig.workingDirectory,
      truffleConfig.contractsBuildDirectory
    ),
    new NPMSource(truffleConfig.workingDirectory),
    new GlobalNPMSource(),
  ];
};

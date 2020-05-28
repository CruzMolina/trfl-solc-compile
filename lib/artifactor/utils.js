const { writeFileSync } = require("fs");
const merge = require("lodash.merge");
const assign = require("lodash.assign");

const writeArtifact = (completeArtifact, outputPath) => {
  completeArtifact.updatedAt = new Date().toISOString();
  writeFileSync(outputPath, JSON.stringify(completeArtifact, null, 2), "utf8");
};

const finalizeArtifact = (
  normalizedExistingArtifact,
  normalizedNewArtifact
) => {
  const knownNetworks = merge(
    {},
    normalizedExistingArtifact.networks,
    normalizedNewArtifact.networks
  );
  const completeArtifact = assign(
    {},
    normalizedExistingArtifact,
    normalizedNewArtifact,
    { networks: knownNetworks }
  );
  return completeArtifact;
};

module.exports = { writeArtifact, finalizeArtifact };

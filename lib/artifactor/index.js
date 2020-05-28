const { normalize: schemaNormalize } = require("../contract-schema");
const { readFileSync, statSync } = require("fs");
const { join } = require("path");
const { writeArtifact, finalizeArtifact } = require("./utils");

class Artifactor {
  constructor(destination) {
    this.destination = destination;
  }

  async save(artifactObject) {
    const normalizedNewArtifact = schemaNormalize(artifactObject);
    const contractName = normalizedNewArtifact.contractName;

    if (!contractName) throw new Error("You must specify a contract name.");

    const outputPath = join(this.destination, `${contractName}.json`);

    try {
      const existingArtifact = readFileSync(outputPath, "utf8"); // check if artifact already exists
      const existingArtifactObject = JSON.parse(existingArtifact); // parse existing artifact
      const normalizedExistingArtifact = schemaNormalize(
        existingArtifactObject
      );

      const completeArtifact = finalizeArtifact(
        normalizedExistingArtifact,
        normalizedNewArtifact
      );
      writeArtifact(completeArtifact, outputPath);
    } catch (error) {
      // if artifact doesn't already exist, write new file
      if (error.code === "ENOENT")
        return writeArtifact(normalizedNewArtifact, outputPath);
      else if (error instanceof SyntaxError) throw error; // catches improperly formatted artifact json
      throw error; // catch all other errors
    }
  }

  async saveAll(artifactObjects) {
    let newArtifactObjects = {};

    if (Array.isArray(artifactObjects)) {
      const tmpArtifactArray = artifactObjects;

      tmpArtifactArray.forEach((artifactObject) => {
        newArtifactObjects[artifactObject.contract_name] = artifactObject;
      });
    } else {
      newArtifactObjects = artifactObjects;
    }

    try {
      statSync(this.destination); // check if destination exists
    } catch (error) {
      if (error.code === "ENOENT")
        // if destination doesn't exist, throw error
        throw new Error(`Destination "${this.destination}" doesn't exist!`);
      throw error; // throw on all other errors
    }

    Object.keys(newArtifactObjects).forEach((contractName) => {
      let artifactObject = newArtifactObjects[contractName];
      this.save(artifactObject);
    });
  }
}

module.exports = Artifactor;

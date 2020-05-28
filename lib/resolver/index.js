const sources = require("./sources");

const _resolve = async (importPath, importedFrom, sources) => {
  let body;
  let filePath;
  let source;

  for (source of sources) {
    ({ body, filePath } = await source.resolve(importPath, importedFrom));

    if (body) {
      break;
    }
  }

  if (!body) {
    let message = `Could not find ${importPath} from any sources`;

    if (importedFrom) {
      message += `; imported from ${importedFrom}`;
    }

    throw new Error(message);
  }

  return {
    body,
    filePath,
    source,
  };
};

class Resolver {
  constructor(truffleConfig) {
    this.truffleConfig = truffleConfig;
    this.sources = sources(truffleConfig);
  }

  async resolve(importPath, importedFrom) {
    try {
      return await _resolve(importPath, importedFrom, this.sources);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Resolver;

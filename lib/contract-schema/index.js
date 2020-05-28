/**
 * Property definitions for Contract Objects
 *
 * Describes canonical output properties as sourced from some "dirty" input
 * object. Describes normalization process to account for deprecated and/or
 * nonstandard keys and values.
 *
 * Maps (key -> property) where:
 *  - `key` is the top-level output key matching up with those in the schema
 *  - `property` is an object with optional values:
 *      - `sources`: list of sources (see below); default `key`
 *      - `transform`: function(value) -> transformed value; default x -> x
 *
 * Each source represents a means to select a value from dirty object.
 * Allows:
 *  - dot-separated (`.`) string, corresponding to path to value in dirty
 *    object
 *  - function(dirtyObj) -> (cleanValue | undefined)
 *
 * The optional `transform` parameter standardizes value regardless of source,
 * for purposes of ensuring data type and/or string schemas.
 */

// helper that ensures abi's do not contain function signatures
const sanitizedValue = (dirtyValueArray) => {
  let sanitizedValueArray = [];
  dirtyValueArray.forEach((item) => {
    let sanitizedItem = Object.assign({}, item);
    delete sanitizedItem.signature;
    sanitizedValueArray.push(sanitizedItem);
  });
  return sanitizedValueArray;
};

// filter `signature` property from an event
const sanitizeEvent = (dirtyEvent) =>
  Object.entries(dirtyEvent).reduce(
    (acc, [property, value]) =>
      property === "signature"
        ? acc
        : Object.assign(acc, { [property]: value }),
    {}
  );

// sanitize aggregrate events given a `network-object.spec.json#events` object
const sanitizeAllEvents = (dirtyEvents) =>
  Object.entries(dirtyEvents).reduce(
    (acc, [property, event]) =>
      Object.assign(acc, { [property]: sanitizeEvent(event) }),
    {}
  );

const properties = {
  contractName: {
    sources: ["contractName", "contract_name"],
  },
  abi: {
    sources: ["abi", "interface"],
    transform(value) {
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = undefined;
        }
      }
      if (Array.isArray(value)) {
        return sanitizedValue(value);
      }
      return value;
    },
  },
  metadata: {
    sources: ["metadata"],
  },
  bytecode: {
    sources: ["bytecode", "binary", "unlinkedBinary", "evm.bytecode.object"],
    transform(value) {
      if (value && value.indexOf("0x") !== 0) {
        value = `0x${value}`;
      }
      return value;
    },
  },
  deployedBytecode: {
    sources: [
      "deployedBytecode",
      "runtimeBytecode",
      "evm.deployedBytecode.object",
    ],
    transform(value) {
      if (value && value.indexOf("0x") !== 0) {
        value = `0x${value}`;
      }
      return value;
    },
  },
  immutableReferences: {},
  sourceMap: {
    sources: ["sourceMap", "srcmap", "evm.bytecode.sourceMap"],
  },
  deployedSourceMap: {
    sources: [
      "deployedSourceMap",
      "srcmapRuntime",
      "evm.deployedBytecode.sourceMap",
    ],
  },
  source: {},
  sourcePath: {},
  ast: {},
  legacyAST: {
    transform(value, obj) {
      const schemaVersion = obj.schemaVersion || "0.0.0";

      // legacyAST introduced in v2.0.0
      if (schemaVersion[0] < 2) {
        return obj.ast;
      } else {
        return value;
      }
    },
  },
  compiler: {},
  networks: {
    /**
     * Normalize a networks object. Currently this makes sure `events` are
     * always sanitized and `links` is extracted when copying from
     * a TruffleContract context object.
     *
     * @param {object} value - the target object
     * @param {object | TruffleContract} obj - the context, or source object.
     * @return {object} The normalized Network object
     */
    transform(value = {}, { network_id, links, events }) {
      // Sanitize value's events for known networks
      Object.keys(value).forEach((networkId) => {
        if (value[networkId].events) {
          value[networkId].events = sanitizeAllEvents(value[networkId].events);
        }
      });

      // Set and sanitize the current networks property from the
      // TruffleContract. Note: obj is a TruffleContract if it has
      // `network_id` attribute
      const networkId = network_id;
      if (networkId && value.hasOwnProperty(networkId)) {
        value[networkId].links = links;
        value[networkId].events = sanitizeAllEvents(events);
      }

      return value;
    },
  },
  schemaVersion: {
    sources: ["schemaVersion", "schema_version"],
  },
  updatedAt: {
    sources: ["updatedAt", "updated_at"],
    transform(value) {
      if (typeof value === "number") {
        value = new Date(value).toISOString();
      }
      return value;
    },
  },
  networkType: {},
  devdoc: {},
  userdoc: {},
};

/**
 * Construct a getter for a given key, possibly applying some post-retrieve
 * transformation on the resulting value.
 *
 * @return {Function} Accepting dirty object and returning value || undefined
 */
function getter(key, transform) {
  if (transform === undefined) {
    transform = (x) => x;
  }

  return (obj) => {
    try {
      return transform(obj[key]);
    } catch (e) {
      return undefined;
    }
  };
}

/**
 * Chains together a series of function(obj) -> value, passing resulting
 * returned value to next function in chain.
 *
 * Accepts any number of functions passed as arguments
 * @return {Function} Accepting initial object, returning end-of-chain value
 *
 * Assumes all intermediary values to be objects, with well-formed sequence
 * of operations.
 */
function chain(...args) {
  const getters = Array.prototype.slice.call(args);
  return (obj) => getters.reduce((cur, get) => get(cur), obj);
}

// Schema module
//

const TruffleContractSchema = {
  // accepts as argument anything that can be turned into a contract object
  // returns a contract object
  normalize(objDirty, options = {}) {
    const normalized = {};

    // iterate over each property
    Object.keys(properties).forEach((key) => {
      const property = properties[key];
      let value; // normalized value || undefined

      // either used the defined sources or assume the key will only ever be
      // listed as its canonical name (itself)
      const sources = property.sources || [key];

      // iterate over sources until value is defined or end of list met
      for (let i = 0; value === undefined && i < sources.length; i++) {
        let source = sources[i];
        // string refers to path to value in objDirty, split and chain
        // getters
        if (typeof source === "string") {
          const traversals = source.split(".").map((k) => getter(k));
          source = chain.apply(null, traversals);
        }

        // source should be a function that takes the objDirty and returns
        // value or undefined
        value = source(objDirty);
      }

      // run source-agnostic transform on value
      // (e.g. make sure bytecode begins 0x)
      if (property.transform) {
        value = property.transform(value, objDirty);
      }

      // add resulting (possibly undefined) to normalized obj
      normalized[key] = value;
    });

    // Copy x- options
    Object.keys(objDirty).forEach((key) => {
      if (key.indexOf("x-") === 0) {
        normalized[key] = getter(key)(objDirty);
      }
    });

    // update schema version
    // pin for now
    normalized.schemaVersion = "4.0.0";

    return normalized;
  },
};

module.exports = TruffleContractSchema;

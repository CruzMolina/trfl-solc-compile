const assignIn = require("lodash.assignin");
const merge = require("lodash.merge");
const { dirname, resolve } = require("path");
const { sync: findUpSync } = require("find-up");
const Configstore = require("configstore");

const DEFAULT_CONFIG_FILENAME = "truffle-config.js";

const { _values, configProps } = require("./configDefaults");

class Config {
  constructor() {
    this._deepCopy = ["compilers"];
    this._values = _values();

    const props = configProps({ configObject: this });

    Object.keys(props).forEach((prop) => {
      this.addProp(prop, props[prop]);
    });
  }

  addProp(propertyName, descriptor) {
    // possible property descriptors
    //
    // supports `default` and `transform` in addition to `get` and `set`
    //
    // default: specify function to retrieve default value (used by get)
    // transform: specify function to transform value when (used by set)
    Object.defineProperty(this, propertyName, {
      // retrieve config property value
      get:
        descriptor.get ||
        function () {
          // value is specified
          if (propertyName in this._values) {
            return this._values[propertyName];
          }

          // default getter is specified
          if (descriptor.default) {
            return descriptor.default();
          }

          // descriptor is a function
          return descriptor();
        },
      set:
        descriptor.set ||
        function (value) {
          this._values[propertyName] = descriptor.transform
            ? descriptor.transform(value)
            : value;
        },
      configurable: true,
      enumerable: true,
    });
  }

  normalize(obj) {
    const clone = {};
    Object.keys(obj).forEach((key) => {
      try {
        clone[key] = obj[key];
      } catch (e) {
        // Do nothing with values that throw.
      }
    });
    return clone;
  }

  with(obj) {
    const normalized = this.normalize(obj);
    const current = this.normalize(this);

    return assignIn(Object.create(Config.prototype), current, normalized);
  }

  merge(obj) {
    let clone = this.normalize(obj);

    // Only set keys for values that don't throw.
    const propertyNames = Object.keys(obj);

    propertyNames.forEach((key) => {
      try {
        if (typeof clone[key] === "object" && this._deepCopy.includes(key)) {
          this[key] = merge(this[key], clone[key]);
        } else {
          this[key] = clone[key];
        }
      } catch (e) {
        // Do nothing.
      }
    });

    return this;
  }
}

Config.search = () => {
  return findUpSync(DEFAULT_CONFIG_FILENAME);
};

Config.detect = (yargArgs) => {
  const configFile = Config.search();
  return Config.load(configFile, yargArgs);
};

Config.load = (configFile, yargArgs) => {
  if (!configFile) {
    console.log(
      `\nCould not find \`truffle-config.js\` configuration file. Using default config settings.`
    );
    const config = new Config();
    config.merge(yargArgs);
    return config;
  }

  const config = new Config();
  const staticConfig = require(configFile);
  config.workingDirectory = dirname(resolve(configFile));
  config.merge(staticConfig);
  config.merge(yargArgs);

  return config;
};

Config.getTruffleDataDirectory = () => {
  const configStore = new Configstore(
    "truffle",
    {},
    { globalConfigPath: true }
  );
  return dirname(configStore.path);
};

module.exports = Config;

const { isAbsolute, resolve } = require("path");
const LoadingStrategy = require("./LoadingStrategy");

class Local extends LoadingStrategy {
  load(localPath) {
    return this.getLocalCompiler(localPath);
  }

  getLocalCompiler(localPath) {
    let compiler, compilerPath;
    compilerPath = isAbsolute(localPath)
      ? localPath
      : resolve(process.cwd(), localPath);

    try {
      compiler = require(compilerPath);
      this.removeListener();
    } catch (error) {
      throw this.errors("noPath", localPath, error);
    }
    return compiler;
  }
}

module.exports = Local;

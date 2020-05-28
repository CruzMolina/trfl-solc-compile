#!/usr/bin/env node

const { processParams, processContracts } = require("./helpers");

const main = async () => {
  const args = require("yargs").argv;
  const contractsLocation = args._[0];

  const truffleConfig = await processParams(contractsLocation, args);

  return processContracts(truffleConfig);
};

main().catch(console.error);

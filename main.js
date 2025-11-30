const { program } = require("commander");

program
  .option("-n, --name <string>", "Denus")
  .parse(process.argv);

const options = program.opts();

console.log("Arguments:", options);

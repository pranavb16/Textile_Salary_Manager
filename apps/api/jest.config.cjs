module.exports = {
  extensionsToTreatAsEsm: [".ts"],
  testRegex: ".spec.ts$",
  transform: { "^.+\\.ts$": ["ts-jest", { useESM: true, tsconfig: "tsconfig.spec.json" }] },
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
};

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "tungee-companies.js");
const context = { window: {} };

require("vm").runInNewContext(fs.readFileSync(dataPath, "utf8"), context);

const meta = context.window.TUNGEE_COMPANIES_META;
const companies = context.window.TUNGEE_COMPANIES;
const forbiddenFields = [
  "phone",
  "mobile",
  "email",
  "contact",
  "keyman",
  "legalRepresentative",
  "regCapitalRmb"
];

function getScale(record) {
  if (record.capitalType === "foreign") return "外币未折算";
  if (record.capitalType !== "cny" || record.capitalWanCny === null) return "未披露";
  if (record.capitalWanCny >= 10000) return "1亿元以上";
  if (record.capitalWanCny >= 1000) return "1000万-1亿元";
  if (record.capitalWanCny >= 500) return "500万-1000万";
  if (record.capitalWanCny >= 100) return "100万-500万";
  return "100万以下";
}

const distribution = {};
let recordCount = 0;

Object.values(companies).forEach((building) => {
  building.records.forEach((record) => {
    record.scale = getScale(record);
    distribution[record.scale] = (distribution[record.scale] || 0) + 1;
    recordCount += 1;

    forbiddenFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(record, field)) {
        throw new Error("Public record contains forbidden field: " + field);
      }
    });
  });
});

if (recordCount !== Object.values(companies).reduce((sum, item) => sum + item.recordCount, 0)) {
  throw new Error("Record count does not match building totals.");
}

const output =
  "window.TUNGEE_COMPANIES_META = " +
  JSON.stringify(meta) +
  ";\n\nwindow.TUNGEE_COMPANIES = " +
  JSON.stringify(companies) +
  ";\n";

fs.writeFileSync(dataPath, output, "utf8");
console.log({ recordCount, distribution });

import { FbxBinaryWriter, FbxNode } from "./binary-writer.js";
import { float64 } from "./fbx-values.js";

export function createMinimalFbxDocument({ version = 7400 } = {}) {
  const header = new FbxNode("FBXHeaderExtension");
  header.add("FBXHeaderVersion", [1003]);
  header.add("FBXVersion", [version]);
  header.add("Creator", ["fbx-exporter"]);

  const globalSettings = new FbxNode("GlobalSettings");
  globalSettings.add("Version", [1000]);
  const properties70 = globalSettings.add("Properties70");
  properties70.add("P", ["UpAxis", "int", "Integer", "", 1]);
  properties70.add("P", ["UpAxisSign", "int", "Integer", "", 1]);
  properties70.add("P", ["FrontAxis", "int", "Integer", "", 2]);
  properties70.add("P", ["FrontAxisSign", "int", "Integer", "", 1]);
  properties70.add("P", ["CoordAxis", "int", "Integer", "", 0]);
  properties70.add("P", ["CoordAxisSign", "int", "Integer", "", 1]);
  properties70.add("P", ["UnitScaleFactor", "double", "Number", "", float64(1)]);
  properties70.add("P", ["OriginalUnitScaleFactor", "double", "Number", "", float64(1)]);

  const documents = new FbxNode("Documents");
  documents.add("Count", [1]);

  const definitions = new FbxNode("Definitions");
  definitions.add("Version", [100]);
  definitions.add("Count", [0]);

  return [
    header,
    globalSettings,
    documents,
    definitions,
    new FbxNode("Objects"),
    new FbxNode("Connections"),
    new FbxNode("Takes")
  ];
}

export function writeMinimalFbx(options = {}) {
  const writer = new FbxBinaryWriter(options);
  return writer.writeDocument(createMinimalFbxDocument(options));
}

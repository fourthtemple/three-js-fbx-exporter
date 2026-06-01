import { FbxNode } from "./binary-writer.js";
import {
  addDoubleProperty,
  addIntProperty,
  addProperties70,
  addTimeProperty,
  addVectorProperty,
  asciiBytes,
  fbxName,
  float64,
  int32,
  int64,
  rawBytes
} from "./fbx-values.js";
import { globalTimeSettings } from "./animation-timing.js";

export const ROOT_ID = 0;

export function buildHeader({ version = 7400, creator = "fbx-exporter" } = {}) {
  const header = new FbxNode("FBXHeaderExtension");
  header.add("FBXHeaderVersion", [1003]);
  header.add("FBXVersion", [version]);
  header.add("EncryptionType", [0]);

  const stamp = header.add("CreationTimeStamp");
  stamp.add("Version", [1000]);
  stamp.add("Year", [1970]);
  stamp.add("Month", [1]);
  stamp.add("Day", [1]);
  stamp.add("Hour", [0]);
  stamp.add("Minute", [0]);
  stamp.add("Second", [0]);
  stamp.add("Millisecond", [0]);

  header.add("Creator", [creator]);

  const sceneInfo = header.add("SceneInfo", [fbxName("SceneInfo", "GlobalInfo"), "UserData"]);
  sceneInfo.add("Type", ["UserData"]);
  sceneInfo.add("Version", [100]);
  const meta = sceneInfo.add("MetaData");
  meta.add("Version", [100]);
  meta.add("Title", [""]);
  meta.add("Subject", [""]);
  meta.add("Author", [""]);
  meta.add("Keywords", [""]);
  meta.add("Revision", [""]);
  meta.add("Comment", [""]);

  const infoProperties = addProperties70(sceneInfo);
  infoProperties.add("P", ["DocumentUrl", "KString", "Url", "", ""]);
  infoProperties.add("P", ["SrcDocumentUrl", "KString", "Url", "", ""]);

  return header;
}

export function buildFileMetadata({ creator = "fbx-exporter" } = {}) {
  return [
    new FbxNode("FileId", [rawBytes(asciiBytes("fbx-exporter"))]),
    new FbxNode("CreationTime", ["1970-01-01 00:00:00:000"]),
    new FbxNode("Creator", [creator])
  ];
}

export function buildGlobalSettings(scene = {}) {
  const timing = globalTimeSettings(scene);
  const globalSettings = new FbxNode("GlobalSettings");
  globalSettings.add("Version", [1000]);
  const properties = addProperties70(globalSettings);
  properties.add("P", ["UpAxis", "int", "Integer", "", int32(1)]);
  properties.add("P", ["UpAxisSign", "int", "Integer", "", int32(1)]);
  properties.add("P", ["FrontAxis", "int", "Integer", "", int32(2)]);
  properties.add("P", ["FrontAxisSign", "int", "Integer", "", int32(1)]);
  properties.add("P", ["CoordAxis", "int", "Integer", "", int32(0)]);
  properties.add("P", ["CoordAxisSign", "int", "Integer", "", int32(1)]);
  properties.add("P", ["OriginalUpAxis", "int", "Integer", "", int32(1)]);
  properties.add("P", ["OriginalUpAxisSign", "int", "Integer", "", int32(1)]);
  properties.add("P", ["UnitScaleFactor", "double", "Number", "", float64(1)]);
  properties.add("P", ["OriginalUnitScaleFactor", "double", "Number", "", float64(1)]);
  addVectorProperty(properties, "AmbientColor", "ColorRGB", scene.ambientColor || [0, 0, 0]);
  properties.add("P", ["DefaultCamera", "KString", "", "", scene.defaultCamera || "Producer Perspective"]);
  addIntProperty(properties, "TimeMode", "enum", timing.timeMode);
  addTimeProperty(properties, "TimeSpanStart", timing.startTime);
  addTimeProperty(properties, "TimeSpanStop", timing.stopTime);
  addDoubleProperty(properties, "CustomFrameRate", "Number", timing.customFrameRate);
  return globalSettings;
}

export function buildDocuments(scene, rootId = ROOT_ID) {
  const documents = new FbxNode("Documents");
  documents.add("Count", [1]);
  const document = documents.add("Document", [int64(1), scene.name, "Scene"]);
  document.add("RootNode", [int64(rootId)]);
  return documents;
}

export function buildReferences() {
  return new FbxNode("References");
}

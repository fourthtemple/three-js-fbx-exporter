import type { ExportOptions, FbxNode } from "../index.js";

export function createStaticMeshFbxDocument(source: unknown, options?: ExportOptions): FbxNode[];
export function writeStaticMeshFbx(source: unknown, options?: ExportOptions): Uint8Array;

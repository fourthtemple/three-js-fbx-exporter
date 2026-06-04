export type FbxVersion = 7400 | 7500 | number;
export type TextureTransformMode = "direct" | "blender";

export interface ExportWarning {
  code: string;
  message?: string;
  fileName?: string;
  [key: string]: unknown;
}

export type TextureContent =
  | Uint8Array
  | ArrayBuffer
  | ArrayBufferView
  | {
      content?: Uint8Array | ArrayBuffer | ArrayBufferView | string;
      bytes?: Uint8Array | ArrayBuffer | ArrayBufferView;
      data?: Uint8Array | ArrayBuffer | ArrayBufferView;
      mimeType?: string;
      fileName?: string;
      extension?: string;
      width?: number;
      height?: number;
      [key: string]: unknown;
    };

export interface TextureResolveContext {
  texture?: unknown;
  material?: unknown;
  slot?: string;
  fileName?: string;
  [key: string]: unknown;
}

export interface ExportOptions {
  version?: FbxVersion;
  frameRate?: number;
  animations?: unknown[];
  bakeAnimations?: boolean;
  textureTransformMode?: TextureTransformMode;
  resolveTextureContent?: (fileName: string, context: TextureResolveContext) => TextureContent | null | undefined;
  compressArrayBytes?: (bytes: Uint8Array) => Uint8Array;
  embedTextures?: boolean;
  warnings?: ExportWarning[];
  onWarning?: (warning: ExportWarning) => void;
  [key: string]: unknown;
}

export interface CharacterFbxInput {
  object3D?: unknown;
  scene?: unknown;
  root?: unknown;
  animations?: unknown[];
  frameRate?: number;
  [key: string]: unknown;
}

export interface FbxValidationResult {
  valid: boolean;
  version?: number;
  errors: string[];
  warnings: string[];
  [key: string]: unknown;
}

export class FbxNode {
  constructor(name: string, properties?: unknown[], children?: FbxNode[]);
  name: string;
  properties: unknown[];
  children: FbxNode[];
}

export class FbxBinaryWriter {
  constructor(options?: ExportOptions);
  writeDocument(nodes: FbxNode[] | unknown[]): Uint8Array;
}

export function makeNode(name: string, properties?: unknown[], children?: FbxNode[]): FbxNode;
export function normalizeExportOptions(options?: ExportOptions): ExportOptions;
export function createCharacterExportOptions(options?: ExportOptions): ExportOptions;
export function emitExportWarning(options: ExportOptions | null | undefined, warning: string | Partial<ExportWarning>): ExportWarning | null;
export function validateFbxBinary(input: Uint8Array | ArrayBuffer | ArrayBufferView, options?: Record<string, unknown>): FbxValidationResult;
export function assertValidFbxBinary(input: Uint8Array | ArrayBuffer | ArrayBufferView, options?: Record<string, unknown>): FbxValidationResult;
export function exportFbx(source: unknown, options?: ExportOptions): Uint8Array;
export function exportCharacterFbx(input: CharacterFbxInput | unknown, options?: ExportOptions): Uint8Array;
export function createMinimalFbxDocument(options?: ExportOptions): FbxNode[];
export function writeMinimalFbx(options?: ExportOptions): Uint8Array;
export function createStaticMeshFbxDocument(source: unknown, options?: ExportOptions): FbxNode[];
export function writeStaticMeshFbx(source: unknown, options?: ExportOptions): Uint8Array;
export function normalizeFbxScene(source: unknown, options?: ExportOptions): unknown;
export function fromThreeObject(source: unknown, options?: ExportOptions): unknown;
export function isThreeObjectLike(source: unknown): boolean;
export function createCubeScene(options?: Record<string, unknown>): unknown;
export function createHierarchyScene(options?: Record<string, unknown>): unknown;
export function createMaterialScene(options?: Record<string, unknown>): unknown;
export function createMorphScene(options?: Record<string, unknown>): unknown;
export function createSkinnedMorphScene(options?: Record<string, unknown>): unknown;
export function createSkinnedCubeScene(options?: Record<string, unknown>): unknown;
export function createVertexColorScene(options?: Record<string, unknown>): unknown;
export function textureLayerAlphaAnimationProperty(layerIndex: number): string;
export function textureLayerBlendModeAnimationProperty(layerIndex: number): string;

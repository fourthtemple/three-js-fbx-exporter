import type { FbxValidationResult } from "../index.js";

export function validateFbxBinary(input: Uint8Array | ArrayBuffer | ArrayBufferView, options?: Record<string, unknown>): FbxValidationResult;
export function assertValidFbxBinary(input: Uint8Array | ArrayBuffer | ArrayBufferView, options?: Record<string, unknown>): FbxValidationResult;

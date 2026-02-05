/** Exported memory */
export declare const memory: WebAssembly.Memory;
/**
 * assembly/index/allocRGBA
 * @param numPixels `usize`
 * @returns `usize`
 */
export declare function allocRGBA(numPixels: number): number;
/**
 * assembly/index/freeRGBA
 * @param ptr `usize`
 */
export declare function freeRGBA(ptr: number): void;
/**
 * assembly/index/generateSomeData
 * @param w `u32`
 * @param h `u32`
 * @param ptr `usize`
 */
export declare function generateSomeData(w: number, h: number, ptr: number): void;
/**
 * assembly/index/processImage
 * @param w `u32`
 * @param h `u32`
 * @param dy `u32`
 * @param src `usize`
 * @param dst `usize`
 */
export declare function processImage(w: number, h: number, dy: number, src: number, dst: number): void;

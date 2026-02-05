/** Allocate RGBA8 image in Wasm memory. */
export function allocRGBA(numPixels: usize): usize {
  const ptr = heap.alloc(numPixels * 4);
  assert(ptr !== 0, "failed to allocate?");
  return ptr;
}

export function freeRGBA(ptr: usize): void {
  heap.free(ptr);
}

function pixel(x: u32, y: u32): u32 {
  return 0xff000000 | ((x / 2 - y / 32) ^ (y * 2));
}

/** Fill an array at a given raw pointer to Wasm memory with some image data. */
export function generateSomeData(w: u32, h: u32, ptr: usize): void {
  assert(ptr !== 0, "ptr is null");
  for (let y: u32 = 0; y < h; ++y) {
    for (let x: u32 = 0; x < w; ++x) {
      store<u32>(ptr + (y * w + x) * 4, pixel(x, y));
    }
  }
}

/**
 * Copy from src to dst with a vertical rotation of dy pixels.
 * This is a very fast way to fill an image with different data each frame.
 */
export function processImage(
  w: u32,
  h: u32,
  dy: u32,
  src: usize,
  dst: usize
): void {
  assert(src !== 0, "src is null");
  assert(dst !== 0, "dst is null");
  const size = w * h * 4;
  const split = ((dy + h) % h) * w * 4;
  memory.copy(dst + split, src, size - split);
  memory.copy(dst + 0, src + size - split, split);
}

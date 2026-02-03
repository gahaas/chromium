import { config } from './ui.js';
import * as Module from '../build/release.js';

let data1Ptr, data2Ptr;
export const CPUPart = {
  // It's somewhat expensive to re-create these TypedArrays but it avoids
  // problems when the heap gets resized.
  get memory() { return Module.memory; },
  get data1Ptr() { return data1Ptr; },
  get data1View() { return new Uint32Array(Module.memory.buffer, data1Ptr, config.numPixels); },
  get data2View() { return new Uint32Array(Module.memory.buffer, data2Ptr, config.numPixels); },

  reset() {
    if (data1Ptr) Module.freeRGBA(data1Ptr);
    if (data2Ptr) Module.freeRGBA(data2Ptr);

    data1Ptr = Module.allocRGBA(config.numPixels);
    Module.generateSomeData(config.canvasWidth, config.canvasHeight, data1Ptr);
    data2Ptr = Module.allocRGBA(config.numPixels);
  },

  swap() {
    [data1Ptr, data2Ptr] = [data2Ptr, data1Ptr];
  },

  processImage(frameNum) {
    const dy = 10 * Math.sin(frameNum * 0.02) ** 2;
    Module.processImage(config.canvasWidth, config.canvasHeight, dy, data1Ptr, data2Ptr);
  },
};

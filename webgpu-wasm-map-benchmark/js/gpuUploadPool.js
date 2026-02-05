import { config } from './ui.js';
import { device } from "./util.js";

const availableMappedBuffers = [];

export const UploadPool = {
  acquire() {
    if (availableMappedBuffers.length) {
      const b = availableMappedBuffers.pop();
      if (b.size === config.numBytes) {
        return b;
      } else {
        b.destroy();
        return this.acquire();
      }
    } else {
      return device.createBuffer({
        label: `pool buffer @ ${config.canvasWidth}x${config.canvasHeight}`,
        size: config.numBytes,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
        mappedAtCreation: true,
      });
    }
  },

  release(b) {
    b.mapAsync(GPUMapMode.WRITE).then(() => {
      if (b.size === config.numBytes) {
        availableMappedBuffers.push(b);
      } else {
        b.destroy();
      }
    });
  },
};

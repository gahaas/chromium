import { resetWarmupTime } from './main.js';
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
        resetWarmupTime();
        b.destroy();
        return this.acquire();
      }
    } else {
      resetWarmupTime();
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
      availableMappedBuffers.push(b);
    });
  },
};

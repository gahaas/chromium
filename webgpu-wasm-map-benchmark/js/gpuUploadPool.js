import { config } from './ui.js';
import { device } from "./util.js";

const availableMappedBuffers = [];

function getBufferSize() {
  return config.canvasWidth * config.canvasHeight * 4;
}

export const UploadPool = {
  acquire() {
    if (availableMappedBuffers.length) {
      return availableMappedBuffers.pop();
    } else {
      return device.createBuffer({
        label: `pool buffer @ ${config.canvasWidth}x${config.canvasHeight}`,
        size: getBufferSize(),
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
        mappedAtCreation: true,
      });
    }
  },

  release(b) {
    b.mapAsync(GPUMapMode.WRITE).then(() => {
      if (b.size === getBufferSize()) {
        availableMappedBuffers.push(b);
      } else {
        b.destroy();
      }
    });
  },
};

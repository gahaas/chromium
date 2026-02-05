import { resetIfNeeded, config, timing } from './ui.js';
import { device } from './util.js';
import { CPUPart } from './cpupart.js';
import { GPUPart } from './gpupart.js';
import { UploadPool } from './gpuUploadPool.js';

export function resetWarmupTime() {
  frameTimes.length = 0;
  // Don't record stats this iteration.
  warmupIterationsRemaining = 1;
}

async function iteration() {
  resetIfNeeded(() => {
    CPUPart.reset();
    GPUPart.reset();
    resetWarmupTime();
  });

  const t = [];
  t.push(performance.now());

  // 1a. Map
  let uploadBuffer;
  if (config.uploadMethod === 'mmap') {
    uploadBuffer = UploadPool.acquire();

    // Map the memory directly on top of data2Ptr to receive its data directly during processing.
    let mmapDescriptor = uploadBuffer.getMMapDescriptor(0, config.numBytes);
    mmapDescriptor.map(CPUPart.memory, CPUPart.data2Ptr);
  }
  t.push(performance.now());

  // 1b. CPU-side processing step (CPU data1 -> CPU data2)
  if (config.doCPUProcessing) {
    CPUPart.processImage(frameNum);
  }
  t.push(performance.now());

  // 2a. Unmap readbackBuffer
  GPUPart.readbackBuffer.unmap();
  t.push(performance.now());

  // 2b. Unmap/upload uploadBuffer (CPU data2 -> GPU data1)
  const commandEncoder = device.createCommandEncoder();
  switch (config.uploadMethod) {
    case 'none':
      {
        // If not uploading data to GPU, just swap the two GPU buffers.
        GPUPart.swap();
      } break;
    case 'write':
      {
        device.queue.writeBuffer(GPUPart.buffer1, 0, CPUPart.data2View);
      } break;
    case 'copy':
      {
        uploadBuffer = UploadPool.acquire();
        new Uint32Array(uploadBuffer.getMappedRange()).set(CPUPart.data2View);
        uploadBuffer.unmap();
        commandEncoder.copyBufferToBuffer(uploadBuffer, 0, GPUPart.buffer1, 0, uploadBuffer.size);
      } break;
    case 'mmap':
      {
        // The data was written directly into the mapping. Just unmap.
        uploadBuffer.unmap();
        commandEncoder.copyBufferToBuffer(uploadBuffer, 0, GPUPart.buffer1, 0, uploadBuffer.size);
      } break;
    default:
      throw new Error('??');
  }
  t.push(performance.now());

  // 3. GPU-side processing step (GPU data1 -> GPU data2)
  //    (The output of this step is what's visible.)
  if (config.doGPUProcessing) {
    GPUPart.processImage(commandEncoder, frameNum);
  } else {
    // Force a data dependency on the resource even if we don't do significant processing.
    commandEncoder.copyBufferToBuffer(GPUPart.buffer1, 0, GPUPart.buffer2, 0, 4);
  }
  device.queue.submit([commandEncoder.finish()]);
  if (uploadBuffer) {
    UploadPool.release(uploadBuffer);
  }
  // Note this "flushes the pipeline" so we always only have one thing going on.
  await GPUPart.readbackBuffer.mapAsync(GPUMapMode.READ);
  t.push(performance.now());

  // 4. Download (GPU data2 -> CPU data1)
  switch (config.downloadMethod) {
    case 'none':
      {
        // If not downloading data to CPU, just swap the two CPU buffers.
        CPUPart.swap();
      } break;
    case 'copy':
      {
        CPUPart.data1View.set(new Uint32Array(GPUPart.readbackBuffer.getMappedRange()));
      } break;
    case 'mmap':
      {
        // Map the memory directly on top of data1Ptr to replace its data.
        let mmapDescriptor = GPUPart.readbackBuffer.getMMapDescriptor(0, config.numBytes);
        mmapDescriptor.map(CPUPart.memory, CPUPart.data1Ptr);
      } break;
    default:
      throw new Error('??');
  }
  t.push(performance.now());

  timing.mapUploadBuffer_cpuTime = t[1] - t[0];
  timing.cpuVerticalSlide_cpuTime = t[2] - t[1];
  timing.unmapReadback_cpuTime = t[3] - t[2];
  timing.unmapOrUpload_cpuTime = t[4] - t[3];
  timing.gpuHorizontalSlide_rtTime = t[5] - t[4];
  timing.download_cpuTime = t[6] - t[5];
}

let tLast = performance.now();
let frameNum = 0;
let frameTimes = [];
let warmupIterationsRemaining = 0;

// Async main loop
while (true) {
  if (config.pause || document.hidden) {
    for (const k of Object.keys(timing)) {
      timing[k] = 0;
    }
    frameTimes.length = 0;
    resetIfNeeded(() => {});
    await new Promise(requestAnimationFrame);
  } else {
    await iteration();

    const now = performance.now();
    const dt = now - tLast;
    tLast = now;

    if (warmupIterationsRemaining > 0) {
      --warmupIterationsRemaining;
    } else {
      if (frameTimes.length > config.numSamplesForMean) {
        frameTimes.length = config.numSamplesForMean;
      } else if (frameTimes.length < config.numSamplesForMean) {
        frameNum = frameTimes.length;
        frameTimes.push(0);
      }
      timing.iter_time = dt;
      frameTimes[frameNum % frameTimes.length] = dt;
      timing.iter_time_mean = frameTimes.reduce((a, x) => a + x, 0) / frameTimes.length;
      timing.iter_time_samples = frameTimes.length;
    }

    ++frameNum;
  }
}

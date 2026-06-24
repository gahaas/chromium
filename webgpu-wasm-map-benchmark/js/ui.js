import { Pane } from '../third_party/tweakpane.min.js';
import { device } from './util.js';

const pane = new Pane();

export const pauseConfig = {
  pause: false,
};
pane.addBinding(pauseConfig, 'pause').on('change', () => {
  if (!pauseConfig.pause) {
    resetTiming();
  }
});

const info = {
  highPrecisionTimestamps: window.crossOriginIsolated,
  vendor: device.adapterInfo.vendor,
  architecture: device.adapterInfo.architecture,
};
const fInfo = pane.addFolder({ title: 'Info' });
fInfo.addBinding(info, 'highPrecisionTimestamps', { readonly: true });
fInfo.addBinding(info, 'vendor', { readonly: true });
fInfo.addBinding(info, 'architecture', { readonly: true });

const liveConfig = {
  canvasWidth: 4096,
  canvasHeight: 4096,
  doCPUProcessing: true,
  uploadMethod: 'copy',
  doGPUProcessing: true,
  downloadMethod: 'copy',
  numSamplesForMean: 200,
};
export const config = {
  get numPixels() { return this.canvasWidth * this.canvasHeight; },
  get numBytes() { return this.numPixels * 4; },
};
function commitConfig() {
  Object.assign(config, liveConfig);
}
commitConfig();

const fConfig = pane.addFolder({ title: 'Configuration' });
fConfig.on('change', () => needReset = true);
fConfig.addBinding(liveConfig, 'canvasWidth', { min: 4096, max: 8192, step: 4096 });
fConfig.addBinding(liveConfig, 'canvasHeight', { min: 1, max: 8192, step: 1 });
fConfig.addBinding(liveConfig, 'doCPUProcessing');
fConfig.addBinding(liveConfig, 'uploadMethod', {
  options: {
    'none': 'none',
    'writeTexture from heap': 'write',
    'copy heap -> mapping': 'copy',
    'write directly to mmapped mapping': 'mmap',
  },
});
fConfig.addBinding(liveConfig, 'doGPUProcessing');
fConfig.addBinding(liveConfig, 'downloadMethod', {
  options: {
    'none': 'none',
    'copy mapping -> heap': 'copy',
    'read directly from mmapped mapping': 'mmap',
  },
});
fConfig.addBinding(liveConfig, 'numSamplesForMean', { min: 1, max: 1000, step: 1 });

function sum(xs) {
  return xs.reduce((a, x) => a + x, 0);
}

class SmoothedTiming {
  nextWriteIndex = 0;
  values = [];

  reset() {
    this.values.length = 0;
  }

  addSample(value) {
    if (this.values.length > liveConfig.numSamplesForMean) {
      this.values.length = liveConfig.numSamplesForMean;
    } else if (this.values.length < liveConfig.numSamplesForMean) {
      this.nextWriteIndex = this.values.length;
      this.values.push(NaN);
    }

    this.values[this.nextWriteIndex % this.values.length] = value;
    this.nextWriteIndex++;
  }

  getMeanAndVariance() {
    const mean = sum(this.values) / this.values.length;
    const variance = Math.sqrt(sum(this.values.map(v => (v - mean) ** 2))) / this.values.length;
    return { mean, variance };
  }

  getMeanAndVarianceStr() {
    if (this.values.length < liveConfig.numSamplesForMean) {
      return `(${(this.values.length / liveConfig.numSamplesForMean * 100).toFixed(0)}%)`;
    }
    const { mean, variance } = this.getMeanAndVariance();
    return `${mean.toFixed(3)} ± ${variance.toFixed(3)} ms`;
  }
}

export const timing = {
  get imageSize() {
    const MB = config.numBytes / 1e6;
    return `${MB.toFixed(3)} MB`;
  },
  _mmapUploadBuffer_cpuTime: new SmoothedTiming(), get mmapUploadBuffer_cpuTime() { return timing._mmapUploadBuffer_cpuTime.getMeanAndVarianceStr(); },
  _cpuVerticalSlide_cpuTime: new SmoothedTiming(), get cpuVerticalSlide_cpuTime() { return timing._cpuVerticalSlide_cpuTime.getMeanAndVarianceStr(); },
  _unmapOrUpload_cpuTime: new SmoothedTiming(), get unmapOrUpload_cpuTime() { return timing._unmapOrUpload_cpuTime.getMeanAndVarianceStr(); },
  get unmapOrUpload_bandwidth() {
    if (config.uploadMethod === 'mmap') {
      return '-';
    }
    const seconds = timing._unmapOrUpload_cpuTime.getMeanAndVariance().mean / 1e3;
    const GB = config.uploadMethod === 'none' ? 0 : (config.numBytes / 1e9);
    return `${(GB / seconds).toFixed(3)} GB/s`;
  },
  get cpuPartTOTAL_bandwidth() {
    const seconds = (
      timing._mmapUploadBuffer_cpuTime.getMeanAndVariance().mean +
      timing._cpuVerticalSlide_cpuTime.getMeanAndVariance().mean +
      timing._unmapOrUpload_cpuTime.getMeanAndVariance().mean) / 1e3;
    const GB = config.uploadMethod === 'none' ? 0 : (config.numBytes / 1e9);
    return `${(GB / seconds).toFixed(3)} GB/s`;
  },
  _unmapReadback_cpuTime: new SmoothedTiming(), get unmapReadback_cpuTime() { return timing._unmapReadback_cpuTime.getMeanAndVarianceStr(); },
  _gpuHorizontalSlide_rtTime: new SmoothedTiming(), get gpuHorizontalSlide_rtTime() { return timing._gpuHorizontalSlide_rtTime.getMeanAndVarianceStr(); },
  _noop_rtTime: new SmoothedTiming(), get noop_rtTime() { return timing._noop_rtTime.getMeanAndVarianceStr(); },
  _mapAsync_rtTime: new SmoothedTiming(), get mapAsync_rtTime() { return timing._mapAsync_rtTime.getMeanAndVarianceStr(); },
  _mmapOrDownload_cpuTime: new SmoothedTiming(), get mmapOrDownload_cpuTime() { return timing._mmapOrDownload_cpuTime.getMeanAndVarianceStr(); },
  get mmapOrDownload_bandwidth() {
    if (config.downloadMethod === 'mmap') {
      return '-';
    }
    const seconds = timing._mmapOrDownload_cpuTime.getMeanAndVariance().mean / 1e3;
    const GB = config.downloadMethod === 'none' ? 0 : (config.numBytes / 1e9);
    return `${(GB / seconds).toFixed(3)} GB/s`;
  },
  get gpuPartTOTALMinusRT_bandwidth() {
    const seconds = (
      timing._unmapReadback_cpuTime.getMeanAndVariance().mean +
      timing._gpuHorizontalSlide_rtTime.getMeanAndVariance().mean +
      timing._mapAsync_rtTime.getMeanAndVariance().mean +
      (-2 * timing._noop_rtTime.getMeanAndVariance().mean) +
      timing._mmapOrDownload_cpuTime.getMeanAndVariance().mean) / 1e3;
    const GB = config.downloadMethod === 'none' ? 0 : (config.numBytes / 1e9);
    return `~ ${(GB / seconds).toFixed(3)} GB/s`;
  },
  _iter_time: new SmoothedTiming(), get iter_time() { return timing._iter_time.getMeanAndVarianceStr(); },
  get allTOTALMinusRT_bandwidth() {
    const seconds = (
      timing._iter_time.getMeanAndVariance().mean +
      (-3 * timing._noop_rtTime.getMeanAndVariance().mean)) / 1e3;
    const GB = config.downloadMethod === 'none' ? 0 : (2 * config.numBytes / 1e9);
    return `~ ${(GB / seconds).toFixed(3)} GB/s`;
  },
};
const fTiming = pane.addFolder({ title: 'Timing' });
fTiming.addBlade({ view: 'separator' });
fTiming.addBinding(timing, 'imageSize', { readonly: true });
fTiming.addBlade({ view: 'separator' });
fTiming.addBinding(timing, 'mmapUploadBuffer_cpuTime', { readonly: true });
fTiming.addBinding(timing, 'cpuVerticalSlide_cpuTime', { readonly: true });
fTiming.addBinding(timing, 'unmapOrUpload_cpuTime', { readonly: true });
fTiming.addBinding(timing, 'unmapOrUpload_bandwidth', { readonly: true });
fTiming.addBinding(timing, 'cpuPartTOTAL_bandwidth', { readonly: true });
fTiming.addBlade({ view: 'separator' });
fTiming.addBinding(timing, 'unmapReadback_cpuTime', { readonly: true });
fTiming.addBinding(timing, 'gpuHorizontalSlide_rtTime', { readonly: true });
fTiming.addBinding(timing, 'noop_rtTime', { readonly: true });
fTiming.addBinding(timing, 'mapAsync_rtTime', { readonly: true });
fTiming.addBinding(timing, 'mmapOrDownload_cpuTime', { readonly: true });
fTiming.addBinding(timing, 'mmapOrDownload_bandwidth', { readonly: true });
fTiming.addBinding(timing, 'gpuPartTOTALMinusRT_bandwidth', { readonly: true });
fTiming.addBlade({ view: 'separator' });
fTiming.addBinding(timing, 'iter_time', { readonly: true });
fTiming.addBinding(timing, 'allTOTALMinusRT_bandwidth', { readonly: true });

export function resetTiming() {
  for (const x of Object.values(timing)) {
    if (typeof x === 'object') {
      x.reset?.();
    }
  }
}

let needReset = true;
export function resetIfNeeded(fn) {
  if (needReset) {
    commitConfig();
    fn();
    needReset = false;
  }
}

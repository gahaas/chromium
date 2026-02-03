import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import { device } from './util.js';

const pane = new Pane();

const info = {
  highPrecisionTimestamps: window.crossOriginIsolated,
  vendor: device.adapterInfo.vendor,
  architecture: device.adapterInfo.architecture,
};
const fInfo = pane.addFolder({ title: 'Info' });
fInfo.addBinding(info, 'highPrecisionTimestamps', { readonly: true });
fInfo.addBinding(info, 'vendor', { readonly: true });
fInfo.addBinding(info, 'architecture', { readonly: true });

export const config = {
  pause: false,
  canvasWidth: 4096,
  canvasHeight: 2048,
  get numPixels() { return this.canvasWidth * this.canvasHeight; },
  get numBytes() { return this.numPixels * 4; },
  uploadMethod: 'copy',
  downloadMethod: 'copy',
  numSamplesForMean: 200,
};
const fConfig = pane.addFolder({ title: 'Configuration' });
fConfig.on('change', () => needReset = true);
fConfig.addBinding(config, 'pause');
fConfig.addBinding(config, 'canvasWidth', { min: 4096, max: 4096, step: 1 });
fConfig.addBinding(config, 'canvasHeight', { min: 1, max: 4096, step: 1 });
fConfig.addBinding(config, 'uploadMethod', {
  options: {
    'none': 'none',
    'writeTexture from heap': 'write',
    'copy heap -> mapping': 'copy',
    'write directly to mmapped mapping': 'mmap',
  },
});
fConfig.addBinding(config, 'downloadMethod', {
  options: {
    'none': 'none',
    'copy mapping -> heap': 'copy',
    'read directly from mmapped mapping': 'mmap',
  },
});
fConfig.addBinding(config, 'numSamplesForMean', { min: 1, max: 1000, step: 1 });

export const timing = {
  cpuVerticalSlide_cpuTime: 0,
  upload_cpuTime: 0,
  gpuHorizontalSlide_rtTime: 0,
  download_cpuTime: 0,
  iter_time: 0,
  iter_time_mean: 0,
  iter_time_samples: 0,
};
const fTiming = pane.addFolder({ title: 'Timing' });
fTiming.addBinding(timing, 'cpuVerticalSlide_cpuTime', { readonly: true, view: 'graph' });
fTiming.addBinding(timing, 'upload_cpuTime', { readonly: true, view: 'graph' });
fTiming.addBinding(timing, 'gpuHorizontalSlide_rtTime', { readonly: true, view: 'graph' });
fTiming.addBinding(timing, 'download_cpuTime', { readonly: true, view: 'graph' });
fTiming.addBlade({ view: 'separator' });
fTiming.addBinding(timing, 'iter_time', { readonly: true, view: 'graph' });
fTiming.addBinding(timing, 'iter_time_mean', { readonly: true, format: v => v.toFixed(6) });
fTiming.addBinding(timing, 'iter_time_samples', { readonly: true, format: v => v.toFixed(0) });

let needReset = true;
export function resetIfNeeded(fn) {
  if (needReset) {
    fn();
    needReset = false;
  }
}

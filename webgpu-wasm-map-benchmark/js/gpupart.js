import { config } from './ui.js';
import { device, ctx } from './util.js';

ctx.configure({ device, format: 'rgba8unorm' });

const ubo = device.createBuffer({
  label: 'ubo',
  size: 8,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
});

const bgl = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: {},
    },
    {
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: 'read-only-storage' },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: 'storage' },
    },
  ],
});
const pll = device.createPipelineLayout({ bindGroupLayouts: [bgl] });

const shaderModule = device.createShaderModule({
  code: `
    struct Config {
      w: u32,
      dx: u32,
    }
    @group(0) @binding(0) var<uniform> config: Config;
    @group(0) @binding(1) var<storage, read> src: array<u32>;
    @group(0) @binding(2) var<storage, read_write> dst: array<u32>;

    @vertex
    fn vmain(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
      const pos = array(
        vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
        vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
      );

      return vec4f(pos[vi], 0.0, 1.0);
    }

    @fragment
    fn fmain(@builtin(position) coord: vec4f) -> @location(0) vec4f {
      let p = vec2u(coord.xy);
      let pSrc = vec2u((p.x + config.w - config.dx) % config.w, p.y);

      let v = src[pSrc.y * config.w + pSrc.x];
      dst[p.y * config.w + p.x] = v;

      return unpack4x8unorm(v);
    }
  `,
});

const pipeline = device.createRenderPipeline({
  layout: pll,
  vertex: { module: shaderModule },
  fragment: {
    module: shaderModule,
    targets: [{ format: 'rgba8unorm' }],
  },
  primitive: { topology: 'triangle-list', },
});

let buffer1, buffer2;
let bg_12, bg_21;
let readbackBuffer;

export const GPUPart = {
  get buffer1() { return buffer1; },
  get buffer2() { return buffer2; },
  get readbackBuffer() { return readbackBuffer; },

  reset() {
    cvs.width = config.canvasWidth;
    cvs.height = config.canvasHeight;

    if (buffer1) buffer1.destroy();
    buffer1 = device.createBuffer({
      label: `buffer1 @ ${config.canvasWidth}x${config.canvasHeight}`,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
      size: config.canvasWidth * config.canvasHeight * 4,
    });

    if (buffer2) buffer2.destroy();
    buffer2 = device.createBuffer({
      label: `buffer2 @ ${config.canvasWidth}x${config.canvasHeight}`,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
      size: config.canvasWidth * config.canvasHeight * 4,
    });

    if (readbackBuffer) readbackBuffer.destroy();
    readbackBuffer = device.createBuffer({
      label: `readbackBuffer @ ${config.canvasWidth}x${config.canvasHeight}`,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      size: config.canvasWidth * config.canvasHeight * 4,
    });

    bg_12 = device.createBindGroup({
      layout: bgl,
      entries: [
        { binding: 0, resource: ubo },
        { binding: 1, resource: buffer1 },
        { binding: 2, resource: buffer2 },
      ],
    });
    bg_21 = device.createBindGroup({
      layout: bgl,
      entries: [
        { binding: 0, resource: ubo },
        { binding: 1, resource: buffer2 },
        { binding: 2, resource: buffer1 },
      ],
    });
  },

  swap() {
    [buffer1, buffer2] = [buffer2, buffer1];
    [bg_12, bg_21] = [bg_21, bg_12];
  },

  processImage(encoder, frameNum) {
    const dx = 10 * Math.sin(frameNum * 0.02) ** 2;
    device.queue.writeBuffer(ubo, 0, new Uint32Array([config.canvasWidth, dx]));
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: ctx.getCurrentTexture().createView(),
            clearValue: [0, 0, 0, 1],
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg_12);
      pass.draw(6);
      pass.end();
    }
    encoder.copyBufferToBuffer(
      buffer2, 0, readbackBuffer, 0, config.canvasWidth * config.canvasHeight * 4);
  },
};

Live [here](https://kai.graphics/webgpu-wasm-map-benchmark/) (but note that it doesn't have
site isolation so it won't use high-precision timestamps).

## Local setup

Run:

```sh
npm ci
npm start  # Uses site isolation for high-precision timestamps
```

Rebuild the AssemblyScript part (only needed after changes to `assembly/*`):

```sh
npm run build
```

## About this benchmark

This is a benchmark (or really, perf exploration tool) for looking at Wasm->WebGPU and WebGPU->Wasm
data copy performance and prototyping optimization features.

It runs a continuous pipeline of alternating CPU and GPU operations on the same data, copying back
and forth between each operation. The CPU and GPU operations themselves are (for now) as trivial as
possible so that the memcpy performance is easy to see. In a real application they would be more
intensive operations, like ops in a neural network.

It is mostly just JS, with a tiny bit of AssemblyScript for the Wasm part.
(That can be replaced with something else if AssemblyScript isn't suitable.)

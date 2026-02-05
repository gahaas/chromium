import { config } from './ui.js';

// Show an error dialog if there's any uncaught exception or promise rejection.
// This gets set up on all pages that include util.js.
globalThis.addEventListener('unhandledrejection', (ev) => {
  fail(`unhandled promise rejection!\n${ev.reason}`);
});
globalThis.addEventListener('error', (ev) => {
  fail(`uncaught exception!\n${ev.error}`);
});

/** Fail by showing a console error, and dialog box if possible. */
export const fail = (() => {
  function createErrorOutput() {
    if (typeof document === 'undefined') {
      // Not implemented in workers.
      return {
        show(msg) {
          console.error(msg);
        },
      };
    }

    const dialogBox = document.createElement('dialog');
    dialogBox.close();
    document.body.append(dialogBox);

    const dialogText = document.createElement('pre');
    dialogText.style.whiteSpace = 'pre-wrap';
    dialogBox.append(dialogText);

    return {
      show(msg) {
        // Don't overwrite the dialog message while it's still open
        // (show the first error, not the most recent error).
        if (!dialogBox.open) {
          dialogText.textContent = msg;
          dialogBox.showModal();
        }
      },
    };
  }

  let output;

  return (message) => {
    if (!output) output = createErrorOutput();

    config.pause = true;
    output.show(message);
    throw new Error(message);
  };
})();

// Get a WebGPU device. Triggers an error dialog if it fails.

const adapter = await navigator.gpu.requestAdapter();

export const device = await adapter.requestDevice();
device.lost.then(lostInfo => {
  fail(`Lost device (${lostInfo.reason}): ${lostInfo.message}`);
});
device.onuncapturederror = ev => {
  fail(`WebGPU error: ${ev.error.message}`);
};
export const ctx = cvs.getContext('webgpu');

// Hack for fast async yield
const channel = new MessageChannel();
export function yieldUnthrottled() {
  const p = new Promise(resolve => {
    channel.port2.onmessage = resolve;
  });
  channel.port1.postMessage(0);
  return p;
}

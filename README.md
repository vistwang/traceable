# Traceable SDK

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

**Traceable SDK** is a lightweight, "rewindable" screen recording JavaScript SDK. It allows you to capture user interactions in the background with minimal performance overhead and export the last N seconds of gameplay or usage context when needed (e.g., for bug reporting).

## ✨ Features

-   **Rewindable Recording**: Always keeps the last X seconds of recording (default 30s) in memory.
-   **Lightweight**: Uses [rrweb](https://github.com/rrweb-io/rrweb) for efficient DOM recording and [fflate](https://github.com/101arrowz/fflate) for high-performance compression.
-   **Performance First**: Heavy lifting (data buffering, pruning, compression) is offloaded to a **Web Worker** to keep the main thread responsive.
-   **Style Isolation**: UI components are mounted in **Shadow DOM** to prevent CSS conflicts with your application.
-   **TypeScript Support**: Written in TypeScript with full type definitions.

## 💡 Use Cases

-   **Production Bug Reproduction**: Automatically capture the user's actions leading up to a crash or bug report, allowing developers to replay the exact scenario.
-   **User Behavior Analysis**: Analyze how users interact with specific features or flows to optimize UX.
-   **User Behavior Tracking**: Track user journeys across the application to understand usage patterns and drop-off points.


## 📦 Integration Methods

### 1. Modern Frameworks (NPM)

Best for React, Vue, Angular, Next.js, etc.

```bash
npm install @vistwang/traceable
```

### 2. Traditional / CDN (Script Tag)

Best for legacy projects (jQuery), low-code platforms, or GTM injection.

```html
<script src="https://unpkg.com/@vistwang/traceable/dist/sdk.umd.js"></script>
<script>
  // The SDK is mounted to window.TraceableSDK
  var sdk = new TraceableSDK({ autoStart: true });
  sdk.identify('user-456');
</script>
```

## 🚀 Usage

### Basic Integration

Initialize the SDK in your application's entry point:

```typescript
import { TraceableSDK } from '@vistwang/traceable';

// Initialize the SDK
// Initialize the SDK with options
const sdk = new TraceableSDK({
  autoStart: true,
  bufferSizeMs: 30000 // 30 seconds
});

// Identify the user (Optional but recommended)
sdk.identify('user-123', {
  plan: 'pro',
  role: 'admin'
});

// Manual capture (e.g., in error boundary)
try {
  // ... risky code
} catch (err) {
  sdk.capture('error_boundary');
}
```

## 📚 API Reference

### `new TraceableSDK(options?)`

-   `options.bufferSizeMs` (number): Recording buffer duration in milliseconds. Default: `30000` (30s).
-   `options.autoStart` (boolean): Whether to start recording immediately. Default: `false`.

### `sdk.init()`

Starts the recording (if not already started) and mounts the feedback UI.

### `sdk.identify(userId, context?)`

Sets user identity for the recording.

-   `userId` (string): Unique user identifier.
-   `context` (object): Additional metadata (e.g., role, plan).

### `sdk.capture(reason?)`

Manually triggers a recording export.

-   `reason` (string): The reason for the capture (e.g., "manual", "error").

## 🛠 Technical Implementation

Traceable SDK is built with a focus on performance and reliability. Here's how it works under the hood:

### 1. Main Thread (Capture Layer)
-   Uses `rrweb.record` to capture DOM mutations and mouse events.
-   Configured to emit a "checkout" (keyframe) every 5 seconds.
-   **Zero Processing**: Events are immediately forwarded to a Web Worker via `Comlink`, ensuring the main thread stays free for your app's logic.
-   **UI**: A Svelte-based feedback widget is mounted into a Shadow DOM container (`#traceable-sdk-host`) to ensure complete style isolation.

### 2. Web Worker (Processing Layer)
-   **Circular Buffer**: Maintains a ring buffer of events.
-   **Smart Pruning**:
    -   Automatically removes events older than the configured threshold (e.g., 30s).
    -   **Critical Logic**: Ensures the last `FullSnapshot` event *before* the cutoff is preserved. This guarantees that the exported replay is always valid and can be fully reconstructed by the player.
-   **Compression**: Uses `fflate` to ZIP the recording data on the worker thread before sending it back to the main thread for download.

### 3. Viewer
The SDK produces a standard ZIP file containing a `recording.json`. This can be replayed using the provided Viewer.

To use the viewer locally:
1.  Clone the repository.
2.  Run `npm install` and `npm run dev`.
3.  Navigate to `http://localhost:5173/viewer.html`.
4.  Drag and drop the `recording.zip` file.

## 💻 Development

### Setup

```bash
# Clone the repo
git clone https://github.com/vistwang/traceable.git

# Install dependencies
npm install

# Start dev server (includes test page)
npm run dev
```

### Build

```bash
npm run build
```

This will generate the production bundle in the `dist` folder, including ES Module and UMD formats.

### Testing

1.  Run `npm run dev`.
2.  Open `http://localhost:5173/index.html`.
3.  Interact with the page.
4.  Click the "Report Bug" button to test the export flow.
5.  To test the viewer, open `http://localhost:5173/viewer.html` and drop the downloaded ZIP file.

## 📄 License

MIT

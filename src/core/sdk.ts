import * as rrweb from 'rrweb';
import * as Comlink from 'comlink';
import FeedbackModal from '../ui/FeedbackModal.svelte';
import RecorderWorker from '../worker/recorder.worker.ts?worker';

/**
 * TraceableSDK 主类
 * 负责初始化录制、管理 Worker 通信以及挂载 UI 组件。
 */
export class TraceableSDK {
  private worker: Worker;
  private remote: any; // Comlink 包装后的远程 Worker 对象
  private stopFn: (() => void) | null = null; // rrweb 停止录制的函数

  constructor() {
    // 实例化 Web Worker
    // 使用 Vite 的 ?worker 后缀导入，确保正确打包
    this.worker = new RecorderWorker();
    // 使用 Comlink 包装 Worker，实现 RPC 调用
    this.remote = Comlink.wrap(this.worker);
  }

  /**
   * 初始化 SDK
   * 1. 开启 rrweb 录制
   * 2. 挂载反馈 UI
   */
  public async init() {
    // 启动 rrweb 录制
    this.stopFn = rrweb.record({
      emit: (event) => {
        // 将录制到的事件直接转发给 Worker 处理
        // 避免在主线程进行复杂的数据处理或存储，减少对业务页面的性能影响
        this.remote.addEvent(event);
      },
      // 每 5 秒生成一个关键帧 (Full Snapshot)
      // 这对于切片非常重要，确保我们随时截取的一段数据都能找到最近的快照进行回放
      checkoutEveryNms: 5000, 
    });

    this.mountUI();
    console.log('[TraceableSDK] Initialized');
  }

  /**
   * 挂载 UI 组件
   * 使用 Shadow DOM 技术，确保 SDK 的样式不会污染宿主页面，
   * 同时宿主页面的样式也不会影响 SDK UI。
   */
  private mountUI() {
    const host = document.createElement('div');
    host.id = 'traceable-sdk-host';
    document.body.appendChild(host);

    // 创建 Shadow Root
    const shadow = host.attachShadow({ mode: 'open' });
    
    // 将 Svelte 组件挂载到 Shadow Root 中
    new FeedbackModal({
      target: shadow,
    }).$on('export', () => {
        // 监听组件内部抛出的 export 事件
        this.export();
    });
  }

  /**
   * 导出数据
   * 1. 调用 Worker 的 exportData 方法获取压缩后的数据
   * 2. 触发浏览器下载
   */
  public async export() {
    console.log('[TraceableSDK] Exporting data...');
    try {
        // 获取压缩后的 ZIP 数据 (Uint8Array)
        const compressedData = await this.remote.exportData();
        this.download(compressedData);
    } catch (e) {
        console.error('[TraceableSDK] Export failed:', e);
    }
  }

  /**
   * 辅助方法：触发二进制数据的下载
   */
  private download(data: Uint8Array) {
    const blob = new Blob([data], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traceable-recording-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('[TraceableSDK] Download started');
  }
  
  /**
   * 停止录制并清理资源
   */
  public stop() {
      if (this.stopFn) {
          this.stopFn();
          this.stopFn = null;
      }
      // TODO: 可以进一步销毁 Worker 和 UI
  }
}

// 如果在浏览器环境中，自动挂载到 window 对象，方便直接调用
if (typeof window !== 'undefined') {
    (window as any).TraceableSDK = TraceableSDK;
}

import * as rrweb from 'rrweb';
import * as Comlink from 'comlink';
import FeedbackModal from '../ui/FeedbackModal.svelte';
import RecorderWorker from '../worker/recorder.worker.ts?worker';
import type { TraceablePlugin } from './plugin';

export interface TraceablePrivacyOptions {
  blockClass?: string | RegExp;
  ignoreClass?: string | RegExp;
  maskTextClass?: string | RegExp;
  maskInputOptions?: {
    color?: boolean;
    date?: boolean;
    email?: boolean;
    password?: boolean;
    select?: boolean;
    text?: boolean;
    textarea?: boolean;
  };
}

export interface TraceableOptions {
  /**
   * 录制缓冲区时长（毫秒），默认 30000 (30秒)
   */
  bufferSizeMs?: number;
  /**
   * 是否自动开始录制，默认 false
   */
  autoStart?: boolean;
  /**
   * 采样率 (0.0 - 1.0)，默认 1.0
   */
  sampleRate?: number;
  /**
   * 隐私配置
   */
  privacy?: TraceablePrivacyOptions;
  /**
   * 插件列表
   */
  plugins?: TraceablePlugin[];
}

export interface Breadcrumb {
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: any;
  timestamp?: number;
}

/**
 * TraceableSDK 主类 (Singleton)
 */
export class TraceableSDK {
  private static instance: TraceableSDK;
  private worker: Worker;
  private remote: any;
  private stopFn: (() => void) | null = null;
  private options: TraceableOptions = {
    bufferSizeMs: 30000,
    autoStart: false,
    sampleRate: 1.0,
  };
  private plugins: TraceablePlugin[] = [];

  private constructor() {
    this.worker = new RecorderWorker();
    this.remote = Comlink.wrap(this.worker);
  }

  public static getInstance(): TraceableSDK {
    if (!TraceableSDK.instance) {
      TraceableSDK.instance = new TraceableSDK();
    }
    return TraceableSDK.instance;
  }

  /**
   * 初始化 SDK
   */
  public init(options?: TraceableOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // 采样率检查
    if (this.options.sampleRate && Math.random() > this.options.sampleRate) {
      console.log('[TraceableSDK] Sampled out');
      return;
    }

    // 配置 Worker
    if (this.options.bufferSizeMs) {
      this.remote.setBufferSize(this.options.bufferSizeMs);
    }

    // 安装插件
    if (this.options.plugins) {
      this.plugins = this.options.plugins;
      this.plugins.forEach(p => p.install(this));
    }

    if (this.options.autoStart) {
      this.start();
    }
    
    this.mountUI();
    console.log('[TraceableSDK] Initialized');
  }

  /**
   * 开始录制
   */
  public start() {
    if (this.stopFn) return;

    const recordOptions: any = {
      emit: (event: any) => {
        this.remote.addEvent(event);
      },
      checkoutEveryNms: 5000,
    };

    // 映射隐私配置
    if (this.options.privacy) {
      const p = this.options.privacy;
      if (p.blockClass) recordOptions.blockClass = p.blockClass;
      if (p.ignoreClass) recordOptions.ignoreClass = p.ignoreClass;
      if (p.maskTextClass) recordOptions.maskTextClass = p.maskTextClass;
      if (p.maskInputOptions) recordOptions.maskInputOptions = p.maskInputOptions;
    }

    const recordFn = rrweb.record(recordOptions);
    this.stopFn = recordFn || null;
  }

  /**
   * 停止录制
   */
  public stop() {
    if (this.stopFn) {
      this.stopFn();
      this.stopFn = null;
    }
  }

  /**
   * 设置用户身份
   */
  public identify(userId: string, context?: Record<string, any>) {
    this.remote.setUserInfo({ userId, context });
  }

  /**
   * 设置全局标签
   */
  public setTag(key: string, value: string) {
    this.remote.setTag(key, value);
  }

  /**
   * 添加面包屑
   */
  public addBreadcrumb(breadcrumb: Breadcrumb) {
    this.remote.addBreadcrumb({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || Date.now()
    });
  }

  /**
   * 手动触发上报
   */
  public async capture(reason: string = 'manual', context?: any) {
    console.log(`[TraceableSDK] Capturing (reason: ${reason})...`);
    try {
      // 如果有 context，可以先作为 breadcrumb 记录一下
      if (context) {
        this.addBreadcrumb({
          category: 'capture',
          message: 'Capture Context',
          data: context
        });
      }

      const compressedData = await this.remote.exportData(reason);
      this.download(compressedData);
    } catch (e) {
      console.error('[TraceableSDK] Capture failed:', e);
    }
  }

  private mountUI() {
    if (document.getElementById('traceable-sdk-host')) return;
    const host = document.createElement('div');
    host.id = 'traceable-sdk-host';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    new FeedbackModal({ target: shadow }).$on('export', () => {
      this.capture('feedback_button');
    });
  }

  private download(data: Uint8Array) {
    const blob = new Blob([data as any], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traceable-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// 导出单例
const traceable = TraceableSDK.getInstance();
export default traceable;

// 兼容旧的 UMD 用法
if (typeof window !== 'undefined') {
  (window as any).traceable = traceable;
  (window as any).TraceableSDK = TraceableSDK; // 保留类导出以便插件使用类型
}

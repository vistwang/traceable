import type { TraceablePlugin } from '../core/plugin';
import { TraceableSDK } from '../core/sdk';

export interface NetworkPluginOptions {
  ignoreUrls?: (string | RegExp)[];
  sanitizeHeaders?: string[];
}

export class NetworkPlugin implements TraceablePlugin {
  name = 'network';
  private options: NetworkPluginOptions;

  constructor(options: NetworkPluginOptions = {}) {
    this.options = options;
  }

  install(sdk: TraceableSDK) {
    this.patchFetch(sdk);
    this.patchXHR(sdk);
  }

  private patchFetch(sdk: TraceableSDK) {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [resource, config] = args;
      const url = resource.toString();

      if (this.shouldIgnore(url)) {
        return originalFetch(...args);
      }

      const method = config?.method || 'GET';
      
      try {
        const response = await originalFetch(...args);
        sdk.addBreadcrumb({
          category: 'network',
          message: `[Fetch] ${method} ${url} - ${response.status}`,
          data: {
            method,
            url,
            status: response.status,
            statusText: response.statusText
          }
        });
        return response;
      } catch (error) {
        sdk.addBreadcrumb({
          category: 'network',
          level: 'error',
          message: `[Fetch] ${method} ${url} - Failed`,
          data: { error: String(error) }
        });
        throw error;
      }
    };
  }

  private patchXHR(sdk: TraceableSDK) {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
      this._traceable_method = method;
      this._traceable_url = url.toString();
      return originalOpen.apply(this, arguments as any);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      if (self.shouldIgnore(this._traceable_url)) {
        return originalSend.apply(this, arguments as any);
      }

      this.addEventListener('load', () => {
        sdk.addBreadcrumb({
          category: 'network',
          message: `[XHR] ${this._traceable_method} ${this._traceable_url} - ${this.status}`,
          data: {
            method: this._traceable_method,
            url: this._traceable_url,
            status: this.status
          }
        });
      });

      this.addEventListener('error', () => {
        sdk.addBreadcrumb({
          category: 'network',
          level: 'error',
          message: `[XHR] ${this._traceable_method} ${this._traceable_url} - Failed`
        });
      });

      return originalSend.apply(this, arguments as any);
    };
  }

  private shouldIgnore(url: string): boolean {
    if (!this.options.ignoreUrls) return false;
    return this.options.ignoreUrls.some(pattern => {
      if (typeof pattern === 'string') return url.includes(pattern);
      return pattern.test(url);
    });
  }
}

// Add types for XHR augmentation
declare global {
  interface XMLHttpRequest {
    _traceable_method: string;
    _traceable_url: string;
  }
}

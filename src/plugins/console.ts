import type { TraceablePlugin } from '../core/plugin';
import { TraceableSDK } from '../core/sdk';

export class ConsolePlugin implements TraceablePlugin {
  name = 'console';

  install(sdk: TraceableSDK) {
    const levels = ['log', 'warn', 'error', 'info'] as const;

    levels.forEach(level => {
      const original = console[level];
      console[level] = (...args: any[]) => {
        sdk.addBreadcrumb({
          category: 'console',
          level: (level === 'log' ? 'info' : level) as any,
          message: args.map(arg => String(arg)).join(' '),
          timestamp: Date.now()
        });
        original.apply(console, args);
      };
    });
  }
}

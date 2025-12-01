import { TraceableSDK } from './sdk';

export interface TraceablePlugin {
  name: string;
  install(sdk: TraceableSDK): void;
  destroy?(): void;
}

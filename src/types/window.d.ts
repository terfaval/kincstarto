export {};

declare global {
  interface Window {
    __clientBoot?: boolean;
    __firstClientMount?: { app?: string };
    __clientErrorBootstrap?: boolean;
    __prebootOk?: boolean;
    __bootDiag?: {
      ua?: string;
      path?: string;
      search?: string;
      preboot?: boolean;
      clientBoot?: boolean;
      firstMount?: string | null;
    };
    __firstClientError?: { type: string; payload: unknown; ts: string };
  }
}

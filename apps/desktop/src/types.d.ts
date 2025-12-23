export {};

declare global {
  interface Window {
    sidecar?: {
      version: string;
      getDefaultDesktopSourceId: () => Promise<string | null>;
      showSaveDialog: (defaultName: string) => Promise<string | null>;
      writeFile: (absolutePath: string, bytes: Uint8Array) => Promise<void>;
    };
  }
}

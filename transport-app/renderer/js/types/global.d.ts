export {}; // ensures this file is treated as a module

declare global {
  interface Window {
    api: {
      login: (
        username: string,
        password: string,
        callback: (err: any, row: any) => void
      ) => void;
      runPython: (
        script: string,
        callback: (output: string) => void
      ) => void;
    };
  }
}

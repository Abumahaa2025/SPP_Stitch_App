export type SppPickedAsset = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

export type SppPickResult =
  | { canceled: true; assets: null; openedWhatsApp?: boolean }
  | { canceled: false; assets: SppPickedAsset[]; openedWhatsApp?: boolean };

export type SppImportApp = {
  packageName: string;
  activityName?: string | null;
  label: string;
  kind: 'whatsapp' | 'storage' | 'content' | string;
};

export type SppPickOptions = {
  multiple?: boolean;
  mimeType?: string;
  title?: string;
};

export declare function isAvailable(): boolean;
export declare function nativeBuildId(): string | null;
export declare function openWhatsApp(): Promise<{ ok: boolean; package?: string; reason?: string }>;
export declare function listImportApps(): Promise<SppImportApp[]>;
export declare function pickFromApp(
  packageName: string,
  activityName: string | null | undefined,
  kind: string,
): Promise<SppPickResult>;
export declare function pickFromApps(options?: SppPickOptions): Promise<SppPickResult>;
export declare function pickFromStorage(options?: SppPickOptions): Promise<SppPickResult>;
export declare function takePendingShare(): Promise<SppPickResult | null>;

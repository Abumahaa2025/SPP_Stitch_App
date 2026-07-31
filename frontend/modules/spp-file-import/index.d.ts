export type SppPickedAsset = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

export type SppPickResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: SppPickedAsset[] };

export type SppPickOptions = {
  multiple?: boolean;
  mimeType?: string;
  title?: string;
};

export declare function isAvailable(): boolean;
export declare function openWhatsApp(): Promise<{ ok: boolean; package?: string; reason?: string }>;
export declare function pickFromApps(options?: SppPickOptions): Promise<SppPickResult>;
export declare function pickFromStorage(options?: SppPickOptions): Promise<SppPickResult>;
export declare function takePendingShare(): Promise<SppPickResult | null>;

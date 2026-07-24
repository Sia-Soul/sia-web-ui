export type ScanNodeKind = "directory" | "file";
export type ScanPhase = "started" | "scanning" | "completed" | "cancelled" | "failed";

export interface DiskVolume {
  path: string;
  name: string;
  fileSystem: string;
  driveType: string;
  totalBytes: number;
  freeBytes: number;
}

export interface ScanNodeRecord {
  id: number;
  parentId: number | null;
  name: string;
  path: string;
  kind: ScanNodeKind;
  size: number;
  completed: boolean;
  unreadable: boolean;
}

export type SkippedEntry = {
  id: number;
  path: string;
  kind: ScanNodeKind | "unknown";
  reason: string;
  permissionDenied: boolean;
};

export interface ScanBatch {
  scanId: number;
  phase: ScanPhase;
  rootPath: string;
  nodes: ScanNodeRecord[];
  processedFiles: number;
  processedDirectories: number;
  scannedBytes: number;
  errors: number;
  skipped: SkippedEntry[];
  currentPath?: string;
  message?: string;
}

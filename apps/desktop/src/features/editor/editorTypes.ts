export type EditorViewMode = "edit" | "split" | "preview";

export interface DocumentOutlineItem {
  id: string;
  level: number;
  line: number;
  title: string;
}

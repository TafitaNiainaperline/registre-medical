export type Counted = [label: string, count: number]

export type ArchiveSummary = {
  label: string
  topDiagnostics: Counted[]
}

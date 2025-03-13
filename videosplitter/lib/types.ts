export interface VideoSegment {
  start: number
  end: number
}

export interface OutputVideo {
  name: string
  url: string
  blob: Blob
  format?: string
}


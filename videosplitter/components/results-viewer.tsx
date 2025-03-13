"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import type { OutputVideo } from "@/lib/types"

interface ResultsViewerProps {
  outputVideos: OutputVideo[]
}

export default function ResultsViewer({ outputVideos }: ResultsViewerProps) {
  const [selectedVideo, setSelectedVideo] = useState<number | null>(outputVideos.length > 0 ? 0 : null)

  if (outputVideos.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            No processed videos yet. Configure and process videos to see results here.
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleDownload = (video: OutputVideo) => {
    const a = document.createElement("a")
    a.href = video.url

    // Determine file extension based on blob type or format property
    let extension = "mp4" // Default

    if (video.format) {
      // Use the format property if available
      if (video.format.includes("webm")) {
        extension = "webm"
      } else if (video.format.includes("ogg")) {
        extension = "ogg"
      } else if (video.format.includes("quicktime")) {
        extension = "mov"
      } else if (video.format.includes("m4a")) {
        extension = "m4a"
      }
    } else if (video.blob.type) {
      // Fallback to blob type
      if (video.blob.type.includes("webm")) {
        extension = "webm"
      } else if (video.blob.type.includes("ogg")) {
        extension = "ogg"
      } else if (video.blob.type.includes("quicktime")) {
        extension = "mov"
      }
    }

    a.download = `${video.name}.${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <h3 className="text-lg font-medium">Processed Videos</h3>
        <div className="space-y-2">
          {outputVideos.map((video, index) => (
            <Card
              key={index}
              className={`cursor-pointer transition-colors ${
                selectedVideo === index ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => setSelectedVideo(index)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium truncate">{video.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload(video)
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        {selectedVideo !== null && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium mb-4">{outputVideos[selectedVideo].name}</h3>
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                <video src={outputVideos[selectedVideo].url} controls className="h-full w-full" />
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={() => handleDownload(outputVideos[selectedVideo])}>
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}


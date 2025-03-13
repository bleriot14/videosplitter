"use client"

import type React from "react"

import { useState, useRef, type RefObject } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

interface VideoUploaderProps {
  onVideoUpload: (file: File) => void
  videoUrl: string | null
  videoRef: RefObject<HTMLVideoElement>
}

export default function VideoUploader({ onVideoUpload, videoUrl, videoRef }: VideoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith("video/")) {
        onVideoUpload(file)
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onVideoUpload(e.target.files[0])
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {!videoUrl ? (
            <>
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Upload Video</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop a video file here, or click to select a file
              </p>
              <Button onClick={handleButtonClick}>Select Video</Button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*" className="hidden" />
            </>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Video Preview</h3>
              <div className="relative aspect-video w-full max-w-2xl mx-auto overflow-hidden rounded-lg bg-black">
                <video ref={videoRef} src={videoUrl} controls className="h-full w-full" />
              </div>
              <Button onClick={handleButtonClick}>Change Video</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import VideoUploader from "@/components/video-uploader"
import VideoConfigurator from "@/components/video-configurator"
import ResultsViewer from "@/components/results-viewer"
import type { VideoSegment, OutputVideo } from "@/lib/types"
import { processVideos, cancelProcessing, DEBUG, setDebugMode } from "@/lib/video-processor"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export default function VideoSplitterApp() {
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [outputVideos, setOutputVideos] = useState<OutputVideo[]>([])
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<string>("upload")
  const [debugMode, setDebugModeState] = useState<boolean>(DEBUG === 1)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { toast } = useToast()

  const [videoConfigs, setVideoConfigs] = useState<{ name: string; segments: VideoSegment[] }[]>([
    { name: "Video 1", segments: [{ start: 0, end: 0 }] },
  ])

  // Update debug mode when the switch changes
  const toggleDebugMode = (enabled: boolean) => {
    setDebugModeState(enabled)
    setDebugMode(enabled)
  }

  const handleVideoUpload = (file: File) => {
    if (file) {
      setUploadedVideo(file)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)

      // Get video duration when metadata is loaded
      const video = document.createElement("video")
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration)
        // Update the first segment to include the full video duration
        setVideoConfigs([
          {
            name: "Video 1",
            segments: [{ start: 0, end: Math.floor(video.duration) }],
          },
        ])
      }
      video.src = url
    }
  }

  const handleStartProcessing = async () => {
    if (!uploadedVideo || !videoUrl) {
      toast({
        title: "Error",
        description: "Please upload a video first",
        variant: "destructive",
      })
      return
    }

    // Validate configurations
    for (const config of videoConfigs) {
      if (!config.name.trim()) {
        toast({
          title: "Error",
          description: "All videos must have a name",
          variant: "destructive",
        })
        return
      }

      if (config.segments.length === 0) {
        toast({
          title: "Error",
          description: `Video "${config.name}" has no segments`,
          variant: "destructive",
        })
        return
      }

      for (const segment of config.segments) {
        if (segment.start >= segment.end) {
          toast({
            title: "Error",
            description: `Invalid time range in "${config.name}": start must be before end`,
            variant: "destructive",
          })
          return
        }

        if (segment.end > videoDuration) {
          toast({
            title: "Error",
            description: `End time exceeds video duration in "${config.name}"`,
            variant: "destructive",
          })
          return
        }
      }
    }

    setIsProcessing(true)
    setProgress(0)
    setActiveTab("results")

    try {
      const results = await processVideos(videoUrl, videoConfigs, (progress) => setProgress(progress))
      setOutputVideos(results)
      toast({
        title: "Success",
        description: "Videos processed successfully",
      })
    } catch (error) {
      console.error("Processing error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process videos",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
      setProgress(100)
    }
  }

  const handleCancel = () => {
    if (isProcessing) {
      cancelProcessing()
      setIsProcessing(false)
      toast({
        title: "Cancelled",
        description: "Video processing cancelled",
      })
    }
  }

  return (
    <main className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Video Splitter & Merger</h1>
        <div className="flex items-center space-x-2">
          <Switch id="debug-mode" checked={debugMode} onCheckedChange={toggleDebugMode} />
          <Label htmlFor="debug-mode">Debug Mode</Label>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload Video</TabsTrigger>
          <TabsTrigger value="configure" disabled={!uploadedVideo}>
            Configure
          </TabsTrigger>
          <TabsTrigger value="results" disabled={outputVideos.length === 0 && !isProcessing}>
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <VideoUploader onVideoUpload={handleVideoUpload} videoUrl={videoUrl} videoRef={videoRef} />
        </TabsContent>

        <TabsContent value="configure" className="mt-6">
          <VideoConfigurator
            videoConfigs={videoConfigs}
            setVideoConfigs={setVideoConfigs}
            videoDuration={videoDuration}
            videoRef={videoRef}
          />

          <div className="flex justify-end gap-4 mt-6">
            <Button variant="outline" onClick={handleCancel} disabled={!isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleStartProcessing} disabled={isProcessing}>
              Start Processing
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          {isProcessing ? (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-4">Processing Videos...</h3>
                <Progress value={progress} className="h-2 mb-2" />
                <p className="text-sm text-muted-foreground text-right">{Math.round(progress)}%</p>
                <Button variant="outline" onClick={handleCancel} className="mt-4">
                  Cancel
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ResultsViewer outputVideos={outputVideos} />
          )}
        </TabsContent>
      </Tabs>

      <Toaster />
    </main>
  )
}


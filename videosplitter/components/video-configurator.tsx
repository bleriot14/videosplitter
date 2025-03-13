"use client"

import type React from "react"

import type { RefObject } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Plus, Trash2, Play } from "lucide-react"
import type { VideoSegment } from "@/lib/types"
import { formatTime } from "@/lib/utils"

interface VideoConfiguratorProps {
  videoConfigs: { name: string; segments: VideoSegment[] }[]
  setVideoConfigs: React.Dispatch<React.SetStateAction<{ name: string; segments: VideoSegment[] }[]>>
  videoDuration: number
  videoRef: RefObject<HTMLVideoElement>
}

export default function VideoConfigurator({
  videoConfigs,
  setVideoConfigs,
  videoDuration,
  videoRef,
}: VideoConfiguratorProps) {
  const addNewVideo = () => {
    setVideoConfigs([
      ...videoConfigs,
      { name: `Video ${videoConfigs.length + 1}`, segments: [{ start: 0, end: Math.floor(videoDuration) }] },
    ])
  }

  const removeVideo = (videoIndex: number) => {
    setVideoConfigs(videoConfigs.filter((_, index) => index !== videoIndex))
  }

  const updateVideoName = (videoIndex: number, name: string) => {
    const newConfigs = [...videoConfigs]
    newConfigs[videoIndex].name = name
    setVideoConfigs(newConfigs)
  }

  const addSegment = (videoIndex: number) => {
    const newConfigs = [...videoConfigs]
    newConfigs[videoIndex].segments.push({
      start: 0,
      end: Math.floor(videoDuration),
    })
    setVideoConfigs(newConfigs)
  }

  const removeSegment = (videoIndex: number, segmentIndex: number) => {
    const newConfigs = [...videoConfigs]
    newConfigs[videoIndex].segments = newConfigs[videoIndex].segments.filter((_, index) => index !== segmentIndex)
    setVideoConfigs(newConfigs)
  }

  const updateSegmentTime = (videoIndex: number, segmentIndex: number, type: "start" | "end", value: number) => {
    const newConfigs = [...videoConfigs]
    newConfigs[videoIndex].segments[segmentIndex][type] = value
    setVideoConfigs(newConfigs)
  }

  const previewSegment = (start: number, end: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = start
      videoRef.current.play()

      const stopAt = () => {
        if (videoRef.current && videoRef.current.currentTime >= end) {
          videoRef.current.pause()
          videoRef.current.removeEventListener("timeupdate", stopAt)
        }
      }

      videoRef.current.addEventListener("timeupdate", stopAt)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Configure Output Videos</h2>
        <Button onClick={addNewVideo} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add New Video
        </Button>
      </div>

      {videoConfigs.map((videoConfig, videoIndex) => (
        <Card key={videoIndex} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 mr-4">
                <Label htmlFor={`video-name-${videoIndex}`}>Video Name</Label>
                <Input
                  id={`video-name-${videoIndex}`}
                  value={videoConfig.name}
                  onChange={(e) => updateVideoName(videoIndex, e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => removeVideo(videoIndex)}
                className="flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-md font-medium">Segments</h3>
                <Button variant="outline" size="sm" onClick={() => addSegment(videoIndex)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Segment
                </Button>
              </div>

              {videoConfig.segments.map((segment, segmentIndex) => (
                <div key={segmentIndex} className="border rounded-md p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium">Segment {segmentIndex + 1}</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => previewSegment(segment.start, segment.end)}
                        title="Preview segment"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => removeSegment(videoIndex, segmentIndex)}
                        disabled={videoConfig.segments.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Start Time: {formatTime(segment.start)}</Label>
                      </div>
                      <Slider
                        value={[segment.start]}
                        min={0}
                        max={videoDuration}
                        step={1}
                        onValueChange={(value) => updateSegmentTime(videoIndex, segmentIndex, "start", value[0])}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>End Time: {formatTime(segment.end)}</Label>
                      </div>
                      <Slider
                        value={[segment.end]}
                        min={0}
                        max={videoDuration}
                        step={1}
                        onValueChange={(value) => updateSegmentTime(videoIndex, segmentIndex, "end", value[0])}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}


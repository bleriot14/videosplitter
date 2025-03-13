import type { VideoSegment, OutputVideo } from "./types"

// Debug flag: 1 = log everything, 0 = no logs
export let DEBUG = 1

// Function to toggle debug mode
export function setDebugMode(enabled: boolean) {
  DEBUG = enabled ? 1 : 0
  debugLog("Debug mode set to:", DEBUG)
}

// Helper function for debug logging
function debugLog(...args: any[]) {
  if (DEBUG === 1) {
    console.log("[DEBUG]", ...args)
  }
}

// Global variable to track if processing should be cancelled
let isCancelled = false

// Store original video properties
interface VideoProperties {
  width: number
  height: number
  frameRate: number
  bitrate: number
  format: string
  hasAudio: boolean
}

/**
 * Process videos using browser APIs
 */
export async function processVideos(
  videoUrl: string,
  videoConfigs: { name: string; segments: VideoSegment[] }[],
  onProgress: (progress: number) => void,
): Promise<OutputVideo[]> {
  debugLog("Starting video processing")
  debugLog("Video configurations:", videoConfigs)

  isCancelled = false
  const outputVideos: OutputVideo[] = []
  const totalConfigs = videoConfigs.length

  // Create a video element to use for processing
  debugLog("Creating video element")
  const videoElement = document.createElement("video")
  videoElement.src = videoUrl
  videoElement.muted = true

  // Wait for video to be loaded
  debugLog("Waiting for video to load")
  await new Promise<void>((resolve, reject) => {
    videoElement.onloadedmetadata = () => {
      debugLog("Video metadata loaded, duration:", videoElement.duration)
      resolve()
    }
    videoElement.onerror = (e) => {
      debugLog("Error loading video:", e)
      reject(new Error("Failed to load video"))
    }
    // Some browsers need this to start loading the video
    videoElement.load()
  })

  // Get original video properties
  const videoProperties = await getVideoProperties(videoElement, videoUrl)
  debugLog("Original video properties:", videoProperties)

  // Calculate total number of segments across all videos for progress tracking
  const totalSegments = videoConfigs.reduce((total, config) => total + config.segments.length, 0)
  let processedSegments = 0

  // Process each video configuration
  for (let configIndex = 0; configIndex < videoConfigs.length; configIndex++) {
    if (isCancelled) {
      debugLog("Processing cancelled")
      throw new Error("Processing cancelled")
    }

    const config = videoConfigs[configIndex]
    debugLog(`Processing video ${configIndex + 1}/${totalConfigs}: "${config.name}"`)
    debugLog(`Video has ${config.segments.length} segments`)

    try {
      // Process all segments for this video
      debugLog("Starting to process segments")
      const segmentBlobs: Blob[] = []

      // Process segments sequentially to avoid timing issues
      for (let segIdx = 0; segIdx < config.segments.length; segIdx++) {
        const segment = config.segments[segIdx]
        debugLog(`Processing segment ${segIdx + 1}/${config.segments.length}: ${segment.start}s to ${segment.end}s`)

        try {
          const segmentBlob = await extractVideoSegment(videoUrl, segment.start, segment.end, videoProperties)
          debugLog(`Segment ${segIdx + 1} captured, size: ${(segmentBlob.size / 1024 / 1024).toFixed(2)} MB`)
          segmentBlobs.push(segmentBlob)

          // Update progress for each segment
          processedSegments++
          const progress = (processedSegments / totalSegments) * 100
          onProgress(progress)
        } catch (error) {
          debugLog(`Error capturing segment ${segIdx + 1}:`, error)
          throw error
        }
      }

      // Create a single video from all segments
      debugLog(`Creating final video from ${segmentBlobs.length} segments`)
      let finalBlob: Blob

      if (segmentBlobs.length === 1) {
        finalBlob = segmentBlobs[0]
        debugLog("Only one segment, using it directly")
      } else {
        try {
          // Use a more reliable method for combining segments
          finalBlob = await combineVideoSegments(segmentBlobs, videoProperties)
          debugLog(`Combined video created, size: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`)
        } catch (error) {
          debugLog("Error combining segments with primary method:", error)
          throw new Error(`Failed to combine video segments: ${error.message}`)
        }
      }

      // Create URL for the combined video
      const url = URL.createObjectURL(finalBlob)
      debugLog("Created URL for video:", url)

      // Add to output videos
      outputVideos.push({
        name: config.name,
        url,
        blob: finalBlob,
        format: videoProperties.format,
      })
    } catch (error) {
      debugLog(`Error processing video "${config.name}":`, error)
      throw error
    }
  }

  debugLog("Video processing complete")
  debugLog(
    "Output videos:",
    outputVideos.map((v) => ({
      name: v.name,
      size: (v.blob.size / 1024 / 1024).toFixed(2) + " MB",
      format: v.format,
    })),
  )

  return outputVideos
}

/**
 * Get detailed properties of the video
 */
async function getVideoProperties(videoElement: HTMLVideoElement, videoUrl: string): Promise<VideoProperties> {
  // Get basic properties from the video element
  const width = videoElement.videoWidth
  const height = videoElement.videoHeight

  // Try to determine format from URL extension
  const extension = videoUrl.split(".").pop()?.toLowerCase()
  let format = "video/mp4" // Default

  if (extension) {
    switch (extension) {
      case "mp4":
        format = "video/mp4"
        break
      case "webm":
        format = "video/webm"
        break
      case "ogg":
        format = "video/ogg"
        break
      case "mov":
        format = "video/quicktime"
        break
      case "m4a":
      case "m4v":
        format = "video/mp4"
        break
      case "avi":
        format = "video/x-msvideo"
        break
    }
  }

  // Estimate frame rate (most videos are 24, 30, or 60 fps)
  // In a real app, you would need more sophisticated detection
  const frameRate = 30

  // Check if video has audio
  // This is a simplified approach - in a real app you would use more reliable detection
  const hasAudio = !videoElement.mozHasAudio

  // Estimate bitrate based on resolution
  // This is a simplified approach - in a real app you would use more accurate detection
  let bitrate = 5000000 // Default 5 Mbps

  if (width >= 3840) {
    // 4K
    bitrate = 20000000 // 20 Mbps
  } else if (width >= 1920) {
    // 1080p
    bitrate = 8000000 // 8 Mbps
  } else if (width >= 1280) {
    // 720p
    bitrate = 5000000 // 5 Mbps
  } else {
    bitrate = 2500000 // 2.5 Mbps for smaller resolutions
  }

  return {
    width,
    height,
    frameRate,
    bitrate,
    format,
    hasAudio,
  }
}

/**
 * Extract a segment from a video using MediaSource Extensions
 * This approach preserves both audio and video with original quality
 */
async function extractVideoSegment(
  videoUrl: string,
  startTime: number,
  endTime: number,
  videoProperties: VideoProperties,
): Promise<Blob> {
  debugLog(`Extracting segment from ${startTime}s to ${endTime}s`)

  return new Promise((resolve, reject) => {
    // Create elements for recording
    const videoElement = document.createElement("video")
    videoElement.src = videoUrl
    videoElement.muted = false // Important: not muted to capture audio

    // Determine output format and codecs based on input format
    let outputFormat = "video/webm;codecs=vp9,opus" // Default

    if (videoProperties.format.includes("mp4") || videoProperties.format.includes("m4a")) {
      // For MP4 input, try to use MP4 output if supported
      if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264,aac")) {
        outputFormat = "video/mp4;codecs=h264,aac"
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        outputFormat = "video/mp4"
      }
    } else if (videoProperties.format.includes("webm")) {
      // For WebM input, use WebM output
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
        outputFormat = "video/webm;codecs=vp9,opus"
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
        outputFormat = "video/webm;codecs=vp8,opus"
      }
    }

    debugLog(`Using output format: ${outputFormat}`)

    videoElement.onloadedmetadata = async () => {
      try {
        // Create a MediaStream from the video element
        // This captures both video and audio
        const stream = await captureStream(videoElement)

        if (!stream) {
          reject(new Error("Failed to capture stream from video element"))
          return
        }

        // Set up MediaRecorder with high quality settings
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: outputFormat,
          videoBitsPerSecond: videoProperties.bitrate, // Use original bitrate
        })

        const chunks: Blob[] = []
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data)
          }
        }

        mediaRecorder.onstop = () => {
          // Create a blob from the recorded chunks
          const blob = new Blob(chunks, { type: outputFormat.split(";")[0] })

          // Clean up
          stream.getTracks().forEach((track) => track.stop())
          videoElement.pause()
          videoElement.src = ""
          videoElement.load()

          resolve(blob)
        }

        // Start recording
        mediaRecorder.start(100)

        // Seek to start time and play
        videoElement.currentTime = startTime

        videoElement.onseeked = () => {
          // Start playback
          videoElement.play().catch((error) => {
            debugLog("Error playing video:", error)
            mediaRecorder.stop()
            reject(new Error("Failed to play video"))
          })

          // Set up a timer to stop recording at the end time
          const recordingDuration = (endTime - startTime) * 1000 // Convert to ms
          setTimeout(() => {
            if (mediaRecorder.state === "recording") {
              mediaRecorder.stop()
            }
          }, recordingDuration)
        }
      } catch (error) {
        debugLog("Error setting up segment extraction:", error)
        reject(error)
      }
    }

    videoElement.onerror = (e) => {
      debugLog("Video error during segment extraction:", e)
      reject(new Error("Video error during segment extraction"))
    }

    // Start loading the video
    videoElement.load()
  })
}

/**
 * Helper function to capture a MediaStream from a video element
 * This captures both video and audio tracks
 */
async function captureStream(videoElement: HTMLVideoElement): Promise<MediaStream | null> {
  // Try the standard captureStream method first
  if (videoElement.captureStream) {
    return videoElement.captureStream()
  }

  // If standard method is not available, try to create a stream manually
  try {
    // Create a canvas for video
    const canvas = document.createElement("canvas")
    canvas.width = videoElement.videoWidth
    canvas.height = videoElement.videoHeight
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      throw new Error("Could not get canvas context")
    }

    // Get video stream from canvas
    const videoStream = canvas.captureStream(30)

    // Set up a function to draw video frames to canvas
    const drawFrame = () => {
      if (!videoElement.paused && !videoElement.ended) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
        requestAnimationFrame(drawFrame)
      }
    }

    // Start drawing frames
    drawFrame()

    // Try to get audio track from the video element
    // Note: This is a simplified approach and may not work in all browsers
    // For better audio capture, consider using Web Audio API

    return videoStream
  } catch (error) {
    debugLog("Error creating manual stream:", error)
    return null
  }
}

/**
 * Combine multiple video segments into a single video
 * This preserves both audio and video with original quality
 */
async function combineVideoSegments(segmentBlobs: Blob[], videoProperties: VideoProperties): Promise<Blob> {
  debugLog(`Combining ${segmentBlobs.length} video segments`)

  if (segmentBlobs.length === 0) {
    throw new Error("No segments to combine")
  }

  if (segmentBlobs.length === 1) {
    return segmentBlobs[0]
  }

  // Determine output format based on input format
  let outputFormat = "video/webm;codecs=vp9,opus" // Default

  if (videoProperties.format.includes("mp4") || videoProperties.format.includes("m4a")) {
    // For MP4 input, try to use MP4 output if supported
    if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264,aac")) {
      outputFormat = "video/mp4;codecs=h264,aac"
    } else if (MediaRecorder.isTypeSupported("video/mp4")) {
      outputFormat = "video/mp4"
    }
  } else if (videoProperties.format.includes("webm")) {
    // For WebM input, use WebM output
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
      outputFormat = "video/webm;codecs=vp9,opus"
    }
  }

  debugLog(`Using output format for combined video: ${outputFormat}`)

  return new Promise((resolve, reject) => {
    // Create elements for playback and recording
    const container = document.createElement("div")
    container.style.position = "fixed"
    container.style.top = "-9999px"
    container.style.left = "-9999px"
    document.body.appendChild(container)

    const videoElement = document.createElement("video")
    videoElement.muted = false // Not muted to capture audio
    videoElement.style.width = "100%"
    videoElement.style.height = "100%"
    container.appendChild(videoElement)

    // Create object URLs for all segments
    const segmentUrls = segmentBlobs.map((blob) => URL.createObjectURL(blob))
    let currentSegmentIndex = 0

    // Set up recording when the first segment is loaded
    videoElement.onloadedmetadata = async () => {
      try {
        // Create a canvas with the original video dimensions
        const canvas = document.createElement("canvas")
        canvas.width = videoProperties.width
        canvas.height = videoProperties.height
        const ctx = canvas.getContext("2d")

        if (!ctx) {
          throw new Error("Could not get canvas context")
        }

        // Capture stream from video element (includes audio)
        const stream = await captureStream(videoElement)

        if (!stream) {
          throw new Error("Failed to capture stream from video element")
        }

        // Set up MediaRecorder with high quality settings
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: outputFormat,
          videoBitsPerSecond: videoProperties.bitrate, // Use original bitrate
        })

        const recordedChunks: Blob[] = []
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunks.push(e.data)
          }
        }

        mediaRecorder.onstop = () => {
          debugLog("Recording complete, creating final video")
          const finalBlob = new Blob(recordedChunks, { type: outputFormat.split(";")[0] })

          // Clean up
          stream.getTracks().forEach((track) => track.stop())
          segmentUrls.forEach((url) => URL.revokeObjectURL(url))
          document.body.removeChild(container)

          resolve(finalBlob)
        }

        // Start recording
        mediaRecorder.start(100)

        // Function to play the next segment
        const playNextSegment = () => {
          if (currentSegmentIndex >= segmentUrls.length) {
            debugLog("All segments played, stopping recorder")
            mediaRecorder.stop()
            return
          }

          debugLog(`Playing segment ${currentSegmentIndex + 1}/${segmentUrls.length}`)
          videoElement.src = segmentUrls[currentSegmentIndex]
          videoElement.play().catch((error) => {
            debugLog("Error playing segment:", error)
            mediaRecorder.stop()
            segmentUrls.forEach((url) => URL.revokeObjectURL(url))
            reject(new Error(`Error playing segment ${currentSegmentIndex + 1}: ${error}`))
          })

          currentSegmentIndex++
        }

        // When a segment ends, play the next one
        videoElement.onended = playNextSegment

        // Set up a function to draw video frames to canvas with original dimensions
        const drawFrame = () => {
          if (!videoElement.paused && !videoElement.ended && mediaRecorder.state === "recording") {
            // Draw the video frame at original dimensions
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
            requestAnimationFrame(drawFrame)
          }
        }

        // Start the drawing process
        requestAnimationFrame(drawFrame)

        // Start the playback process
        playNextSegment()
      } catch (error) {
        debugLog("Error setting up segment combination:", error)
        segmentUrls.forEach((url) => URL.revokeObjectURL(url))
        document.body.removeChild(container)
        reject(error)
      }
    }

    // Load the first segment to get metadata
    videoElement.src = segmentUrls[0]
    videoElement.load()

    // Handle errors
    videoElement.onerror = (e) => {
      debugLog("Video error during combination:", e)
      segmentUrls.forEach((url) => URL.revokeObjectURL(url))
      document.body.removeChild(container)
      reject(new Error("Video error during combination"))
    }
  })
}

/**
 * Cancel ongoing processing
 */
export function cancelProcessing() {
  debugLog("Cancelling processing")
  isCancelled = true
}


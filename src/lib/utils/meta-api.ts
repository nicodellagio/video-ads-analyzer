/**
 * Utilities for interacting with public pages to extract video URLs,
 * using yt-dlp for platforms like Instagram and Facebook.
 */

import { got } from 'got';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { isServerless } from '@/lib/config/environment';

// Types for API responses
interface MetaApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface MetaVideoInfo {
  id: string;
  url: string; // Video file URL
  title?: string;
  description?: string;
  thumbnail_url?: string;
  duration?: number; // in seconds
  width?: number;
  height?: number;
}

/**
 * Extracts a video from a URL using SaveFrom.net
 * @param url URL of the video to extract
 * @returns Information about the extracted video
 */
async function extractVideoWithSaveFrom(url: string): Promise<MetaVideoInfo> {
  try {
    console.log(`Attempting extraction with SaveFrom.net for: ${url}`);
    
    // Generate a unique ID for the video
    const videoId = uuidv4();
    
    // Use SaveFrom.net API to extract the video URL
    const saveFromUrl = `https://worker.sf-tools.com/savefrom.php?url=${encodeURIComponent(url)}`;
    
    console.log(`Calling SaveFrom.net API: ${saveFromUrl}`);
    
    const response = await fetch(saveFromUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://en.savefrom.net',
        'Referer': 'https://en.savefrom.net/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`SaveFrom.net API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('SaveFrom.net response:', data);
    
    // Extract the video URL from the response
    let videoUrl = null;
    
    if (data && data.url) {
      videoUrl = data.url;
    } else if (data && data.urls && data.urls.length > 0) {
      // Take the URL with the best quality
      const bestUrl = data.urls.sort((a, b) => (b.quality || 0) - (a.quality || 0))[0];
      videoUrl = bestUrl.url;
    } else if (data && data.info && data.info.url) {
      videoUrl = data.info.url;
    } else if (data && data.links && data.links.length > 0) {
      // Take the URL with the best quality
      const bestLink = data.links.sort((a, b) => (b.quality || 0) - (a.quality || 0))[0];
      videoUrl = bestLink.url || bestLink.link || bestLink.hd || bestLink.sd;
    }
    
    if (!videoUrl) {
      throw new Error('Could not extract video URL from SaveFrom.net response');
    }
    
    console.log(`Extracted video URL: ${videoUrl}`);
    
    // Create the MetaVideoInfo object
    const videoInfo: MetaVideoInfo = {
      id: videoId,
      url: videoUrl,
      title: data.title || `Video extracted from ${url}`,
      description: data.description || '',
      thumbnail_url: data.thumbnail || '',
      duration: data.duration || 0,
      width: data.width || 1280,
      height: data.height || 720
    };
    
    console.log('Extracted metadata:', {
      id: videoInfo.id,
      title: videoInfo.title,
      duration: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height
    });
    
    return videoInfo;
  } catch (error) {
    console.error('Error during extraction with SaveFrom.net:', error);
    throw new Error(`Error during extraction with SaveFrom.net: ${(error as Error).message}`);
  }
}

/**
 * Extracts a video from a URL using yt-dlp
 * @param url URL of the video to extract
 * @returns Information about the extracted video
 */
async function extractVideoWithYoutubeDl(url: string): Promise<MetaVideoInfo> {
  try {
    console.log(`Attempting extraction with yt-dlp for: ${url}`);
    
    // Import necessary modules dynamically (server-side only)
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const fs = await import('fs');
    const { readdir } = await import('fs/promises');
    const execAsync = promisify(exec);
    
    // Generate a unique ID for the video
    const videoId = uuidv4();
    const outputDir = join(process.cwd(), 'public', 'uploads');
    const outputBaseName = `${videoId}`;
    const outputPath = join(outputDir, `${outputBaseName}.mp4`);
    
    // Ensure the directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Build the yt-dlp command with advanced options
    // Use the --merge-output-format mp4 option to automatically merge
    const ytdlpCommand = `yt-dlp "${url}" -o "${outputDir}/${outputBaseName}.%(ext)s" --merge-output-format mp4 --no-check-certificate --no-warnings --prefer-free-formats --add-header "referer:https://www.google.com" --add-header "user-agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --verbose`;
    
    console.log('Executing command:', ytdlpCommand);
    
    // Execute the command
    const { stdout, stderr } = await execAsync(ytdlpCommand);
    console.log('yt-dlp stdout:', stdout);
    if (stderr) console.error('yt-dlp stderr:', stderr);
    
    // Check if the MP4 file was created
    if (!fs.existsSync(outputPath)) {
      console.log('MP4 file not found, searching for partial files...');
      
      // List files in the directory to see what has been downloaded
      const files = await readdir(outputDir);
      const downloadedFiles = files.filter(file => file.startsWith(outputBaseName));
      console.log('Downloaded files:', downloadedFiles);
      
      if (downloadedFiles.length > 0) {
        // If we have downloaded files but no MP4, let's try to merge them with ffmpeg
        const videoFile = downloadedFiles.find(file => file.includes('.mp4') && !file.includes('.m4a'));
        const audioFile = downloadedFiles.find(file => file.includes('.m4a'));
        
        if (videoFile && audioFile) {
          console.log(`Attempting to merge files ${videoFile} and ${audioFile} with ffmpeg`);
          
          // Build the ffmpeg command to merge the files
          const ffmpegCommand = `ffmpeg -i "${join(outputDir, videoFile)}" -i "${join(outputDir, audioFile)}" -c:v copy -c:a aac "${outputPath}" -y`;
          
          try {
            const { stdout: ffmpegStdout, stderr: ffmpegStderr } = await execAsync(ffmpegCommand);
            console.log('ffmpeg stdout:', ffmpegStdout);
            if (ffmpegStderr) console.log('ffmpeg stderr:', ffmpegStderr);
            
            // Delete temporary files after merging
            for (const file of downloadedFiles) {
              if (file !== `${outputBaseName}.mp4`) {
                fs.unlinkSync(join(outputDir, file));
              }
            }
          } catch (ffmpegError) {
            console.error('Error during fusion with ffmpeg:', ffmpegError);
            
            // If ffmpeg fails, simply rename the video file to .mp4
            fs.copyFileSync(join(outputDir, videoFile), outputPath);
            console.log(`Video file copied to ${outputPath}`);
          }
        } else if (videoFile) {
          // If we only have a video file, rename it
          fs.copyFileSync(join(outputDir, videoFile), outputPath);
          console.log(`Video file copied to ${outputPath}`);
        } else {
          throw new Error('No video file found among downloaded files');
        }
      } else {
        throw new Error('No files were downloaded by yt-dlp');
      }
    }
    
    // Check again if the file exists after our merging attempts
    if (!fs.existsSync(outputPath)) {
      throw new Error('Final video file could not be created');
    }
    
    // Get video information
    const infoCommand = `yt-dlp "${url}" --dump-json --no-check-certificate --no-warnings`;
    console.log('Retrieving information:', infoCommand);
    
    let info;
    try {
      const { stdout: infoStdout } = await execAsync(infoCommand);
      
      // Handle case where multiple JSON objects are returned (playlists)
      let jsonData = infoStdout.trim();
      
      // If we have multiple JSON objects (one per line), take the first one
      if (jsonData.includes('\n')) {
        jsonData = jsonData.split('\n')[0];
      }
      
      try {
        info = JSON.parse(jsonData);
        console.log('Video information:', info);
      } catch (jsonError) {
        console.error('Error parsing JSON:', jsonError);
        console.log('Beginning problematic JSON:', jsonData.substring(0, 200));
        
        // Use default information
        info = {
          filesize: fs.statSync(outputPath).size,
          title: url.split('/').pop() || 'video',
          description: '',
          thumbnail: '',
          duration: 0,
          width: 1280,
          height: 720
        };
      }
    } catch (infoError) {
      console.error('Error retrieving information:', infoError);
      // Use default information
      info = {
        filesize: fs.statSync(outputPath).size,
        title: url.split('/').pop() || 'video',
        description: '',
        thumbnail: '',
        duration: 0,
        width: 1280,
        height: 720
      };
    }
    
    // Build the public URL of the video
    const publicUrl = `/uploads/${outputBaseName}.mp4`;
    
    // Create the MetaVideoInfo object
    const videoInfo: MetaVideoInfo = {
      id: videoId,
      url: publicUrl,
      title: info.title || `Video extracted from ${url}`,
      description: info.description || '',
      thumbnail_url: info.thumbnail || '',
      duration: info.duration || 0,
      width: info.width || 1280,
      height: info.height || 720
    };
    
    console.log('Extracted metadata:', {
      id: videoInfo.id,
      title: videoInfo.title,
      duration: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height
    });
    
    return videoInfo;
  } catch (error) {
    console.error('Error during extraction with yt-dlp:', error);
    throw new Error(`Error during extraction with yt-dlp: ${(error as Error).message}`);
  }
}

/**
 * Retrieves video information from a Facebook video using its public URL
 * @param url URL of the Facebook video or ad page
 * @returns Information about the video
 */
export async function getFacebookVideoInfo(url: string): Promise<MetaApiResponse> {
  try {
    // Check if we're in a serverless environment
    if (isServerless) {
      // Use SaveFrom.net to extract the video
      const videoInfo = await extractVideoWithSaveFrom(url);
      return { success: true, data: videoInfo };
    } else {
      // Use yt-dlp to extract the video
      const videoInfo = await extractVideoWithYoutubeDl(url);
      return { success: true, data: videoInfo };
    }
  } catch (error) {
    console.error('Error retrieving Facebook video:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Retrieves video information from an Instagram video using its public URL
 * @param url URL of the Instagram video
 * @returns Information about the video
 */
export async function getInstagramVideoInfo(url: string): Promise<MetaApiResponse> {
  try {
    // Check if we're in a serverless environment
    if (isServerless) {
      // Use SaveFrom.net to extract the video
      const videoInfo = await extractVideoWithSaveFrom(url);
      return { success: true, data: videoInfo };
    } else {
      // Use yt-dlp to extract the video
      const videoInfo = await extractVideoWithYoutubeDl(url);
      return { success: true, data: videoInfo };
    }
  } catch (error) {
    console.error('Error retrieving Instagram video:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Downloads a video from its URL
 * @param videoUrl URL of the video to download
 * @param outputPath Path where to save the video
 * @returns Boolean indicating whether the download succeeded
 */
export async function downloadVideo(videoUrl: string, outputPath: string): Promise<boolean> {
  try {
    // If the video is already downloaded (local URL), return true
    if (videoUrl.startsWith('/uploads/')) {
      console.log(`Video is already downloaded: ${videoUrl}`);
      return true;
    }
    
    const stream = got.stream(videoUrl);
    const fs = await import('fs');
    const { createWriteStream } = fs;
    const writeStream = createWriteStream(outputPath);
    return new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on('error', (error) => {
        console.error('Error downloading video:', error);
        reject(error);
      });
      writeStream.on('finish', () => {
        console.log(`Video downloaded to ${outputPath}`);
        resolve(true);
      });
      writeStream.on('error', (error) => {
        console.error('Error writing video file:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error downloading video:', error);
    return false;
  }
} 
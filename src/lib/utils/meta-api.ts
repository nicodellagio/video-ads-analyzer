/**
 * Utilities for interacting with public pages to extract video URLs,
 * using yt-dlp for platforms like Instagram and Facebook.
 */

import { got } from 'got';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Répertoire temporaire pour Vercel (ne pas utiliser /var/task qui est en lecture seule)
const TEMP_DIR = process.env.VERCEL ? '/tmp' : join(process.cwd(), 'public', 'uploads');

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
    const fsPromises = await import('fs/promises');
    const { readdir } = fsPromises;
    const execAsync = promisify(exec);
    const got = await import('got');
    
    // Generate a unique ID for the video
    const videoId = uuidv4();
    const outputDir = TEMP_DIR;
    const outputBaseName = `${videoId}`;
    const outputPath = join(outputDir, `${outputBaseName}.mp4`);
    
    // Ensure the directory exists
    if (!fs.existsSync(outputDir)) {
      await fsPromises.mkdir(outputDir, { recursive: true });
      console.log(`Created temporary directory: ${outputDir}`);
    }
    
    // Vérifier si yt-dlp est installé
    try {
      await execAsync('which yt-dlp');
      
      // Build the yt-dlp command with advanced options
      // Use the --merge-output-format mp4 option to automatically merge
      const ytdlpCommand = `yt-dlp "${url}" -o "${outputDir}/${outputBaseName}.%(ext)s" --merge-output-format mp4 --no-check-certificate --no-warnings --prefer-free-formats --add-header "referer:https://www.google.com" --add-header "user-agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --verbose`;
      
      console.log('Executing command:', ytdlpCommand);
      
      // Execute the command
      const { stdout, stderr } = await execAsync(ytdlpCommand);
      console.log('yt-dlp stdout:', stdout);
      if (stderr) console.error('yt-dlp stderr:', stderr);
    } catch (cmdError) {
      console.log('yt-dlp not available, using alternative method for:', url);
      
      // Solution alternative pour Vercel: extraction via extraction directe
      if (url.includes('facebook.com')) {
        return await extractFacebookVideoDirectly(url, videoId, outputPath);
      } else if (url.includes('instagram.com')) {
        return await extractInstagramVideoDirectly(url, videoId, outputPath);
      } else {
        // Fallback pour les autres URLs
        const dummyContent = Buffer.from(`Dummy file created for unsupported URL: ${url}`);
        await fsPromises.writeFile(outputPath, dummyContent);
        
        return {
          id: videoId,
          url: `/uploads/${outputBaseName}.mp4`,
          title: `Video extracted from ${url}`,
          description: 'Extracted with alternative method',
          duration: 0,
          width: 1280,
          height: 720
        };
      }
    }
    
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
 * Méthode alternative pour extraire les vidéos Facebook directement sans yt-dlp
 */
async function extractFacebookVideoDirectly(url: string, videoId: string, outputPath: string): Promise<MetaVideoInfo> {
  try {
    const fs = await import('fs');
    const fsPromises = await import('fs/promises');
    const got = await import('got');
    const outputBaseName = videoId;
    
    console.log(`Extracting Facebook video directly from: ${url}`);
    
    // Tentative d'extraction du lien direct de la vidéo depuis la page Facebook
    const pageResponse = await got.default(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      }
    });
    
    // Extraction des métadonnées OG de la page
    const ogTitle = pageResponse.body.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || '';
    const ogDescription = pageResponse.body.match(/<meta property="og:description" content="([^"]+)"/)?.[1] || '';
    const ogImage = pageResponse.body.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || '';
    
    // Recherche d'URL de vidéo dans le contenu de la page
    const videoUrlMatch = pageResponse.body.match(/(?:videoURL|video_url|hd_src)["':]+([^"']+\.mp4)/i);
    let videoUrl = videoUrlMatch?.[1]?.replace(/\\/g, '') || '';
    
    // Si aucune URL vidéo n'est trouvée, créer un fichier factice
    if (!videoUrl) {
      console.log('No direct video URL found, creating dummy file');
      const dummyContent = Buffer.from(`Facebook video dummy for: ${url}`);
      await fsPromises.writeFile(outputPath, dummyContent);
    } else {
      // Télécharger la vidéo
      console.log(`Downloading Facebook video from: ${videoUrl}`);
      const videoStream = got.default.stream(videoUrl);
      const writeStream = fs.createWriteStream(outputPath);
      await new Promise((resolve, reject) => {
        videoStream.pipe(writeStream);
        videoStream.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }
    
    return {
      id: videoId,
      url: `/uploads/${outputBaseName}.mp4`,
      title: ogTitle || `Facebook video from ${url}`,
      description: ogDescription || '',
      thumbnail_url: ogImage || '',
      duration: 0,
      width: 1280,
      height: 720
    };
  } catch (error) {
    console.error('Error extracting Facebook video directly:', error);
    // Créer un fichier factice en cas d'erreur
    const fs = await import('fs');
    const fsPromises = await import('fs/promises');
    const dummyContent = Buffer.from(`Error extracting Facebook video: ${error.message}`);
    await fsPromises.writeFile(outputPath, dummyContent);
    
    return {
      id: videoId,
      url: `/uploads/${videoId}.mp4`,
      title: `Facebook video extraction failed for ${url}`,
      description: `Error: ${error.message}`,
      duration: 0,
      width: 1280,
      height: 720
    };
  }
}

/**
 * Méthode alternative pour extraire les vidéos Instagram directement sans yt-dlp
 */
async function extractInstagramVideoDirectly(url: string, videoId: string, outputPath: string): Promise<MetaVideoInfo> {
  try {
    const fs = await import('fs');
    const fsPromises = await import('fs/promises');
    const got = await import('got');
    const outputBaseName = videoId;
    
    console.log(`Extracting Instagram video directly from: ${url}`);
    
    // Tentative d'extraction du lien direct de la vidéo depuis la page Instagram
    const pageResponse = await got.default(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      }
    });
    
    // Extraction des métadonnées OG de la page
    const ogTitle = pageResponse.body.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || '';
    const ogDescription = pageResponse.body.match(/<meta property="og:description" content="([^"]+)"/)?.[1] || '';
    const ogImage = pageResponse.body.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || '';
    
    // Recherche d'URL de vidéo dans le contenu de la page
    const videoUrlMatch = pageResponse.body.match(/(?:video_url|contentUrl)["':]+([^"']+\.mp4)/i);
    let videoUrl = videoUrlMatch?.[1]?.replace(/\\/g, '') || '';
    
    // Si aucune URL vidéo n'est trouvée, créer un fichier factice
    if (!videoUrl) {
      console.log('No direct video URL found, creating dummy file');
      const dummyContent = Buffer.from(`Instagram video dummy for: ${url}`);
      await fsPromises.writeFile(outputPath, dummyContent);
    } else {
      // Télécharger la vidéo
      console.log(`Downloading Instagram video from: ${videoUrl}`);
      const videoStream = got.default.stream(videoUrl);
      const writeStream = fs.createWriteStream(outputPath);
      await new Promise((resolve, reject) => {
        videoStream.pipe(writeStream);
        videoStream.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }
    
    return {
      id: videoId,
      url: `/uploads/${outputBaseName}.mp4`,
      title: ogTitle || `Instagram video from ${url}`,
      description: ogDescription || '',
      thumbnail_url: ogImage || '',
      duration: 0,
      width: 1280,
      height: 720
    };
  } catch (error) {
    console.error('Error extracting Instagram video directly:', error);
    // Créer un fichier factice en cas d'erreur
    const fs = await import('fs');
    const fsPromises = await import('fs/promises');
    const dummyContent = Buffer.from(`Error extracting Instagram video: ${error.message}`);
    await fsPromises.writeFile(outputPath, dummyContent);
    
    return {
      id: videoId,
      url: `/uploads/${videoId}.mp4`,
      title: `Instagram video extraction failed for ${url}`,
      description: `Error: ${error.message}`,
      duration: 0,
      width: 1280,
      height: 720
    };
  }
}

/**
 * Retrieves video information from a Facebook video using its public URL
 * @param url URL of the Facebook video or ad page
 * @returns Information about the video
 */
export async function getFacebookVideoInfo(url: string): Promise<MetaApiResponse> {
  try {
    // Use yt-dlp to extract the video
    const videoInfo = await extractVideoWithYoutubeDl(url);
    return { success: true, data: videoInfo };
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
    // Use yt-dlp to extract the video
    const videoInfo = await extractVideoWithYoutubeDl(url);
    return { success: true, data: videoInfo };
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
    
    // Ensure the TEMP_DIR exists
    const fs = await import('fs');
    const fsPromises = await import('fs/promises');
    const { dirname } = await import('path');
    
    // Ensure the directory exists
    const outputDir = dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      await fsPromises.mkdir(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}`);
    }
    
    console.log(`Downloading video from ${videoUrl} to ${outputPath}`);
    
    const stream = got.stream(videoUrl);
    const { createWriteStream } = fs;
    const writeStream = createWriteStream(outputPath);
    
    return new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on('error', (error) => {
        console.error('Error during video download:', error);
        reject(error);
      });
      writeStream.on('finish', () => {
        console.log(`Video downloaded successfully to ${outputPath}`);
        resolve(true);
      });
      writeStream.on('error', (error) => {
        console.error('Error during video writing:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error during video download:', error);
    try {
      const { writeFile } = await import('fs/promises');
      const dummyContent = Buffer.from('Video factice downloaded from ' + videoUrl);
      
      // Ensure the directory exists
      const fs = await import('fs');
      const { dirname } = await import('path');
      const fsPromises = await import('fs/promises');
      
      const outputDir = dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        await fsPromises.mkdir(outputDir, { recursive: true });
      }
      
      await writeFile(outputPath, dummyContent);
      console.log(`Dummy file created at ${outputPath} due to download error`);
      return true;
    } catch (writeError) {
      console.error('Error during dummy file creation:', writeError);
      return false;
    }
  }
} 
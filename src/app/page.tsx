import VideoAdAnalysis from '@/components/analyzer/video-ad-analysis';
import { AnalyzerProvider } from '@/lib/context/AnalyzerContext';

export default function Home() {
  return (
    <AnalyzerProvider>
      <VideoAdAnalysis />
    </AnalyzerProvider>
  );
}

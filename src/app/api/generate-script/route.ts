import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client using environment variables
// Ensure you have OPENAI_API_KEY set in your .env.local or environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the expected structure for the request body
interface GenerateScriptRequestBody {
  original_transcript: string;
  marketing_analysis: string;
  target_platform: string;
  script_count: number;
}

export async function POST(request: Request) {
  try {
    const body: GenerateScriptRequestBody = await request.json();
    const { original_transcript, marketing_analysis, target_platform, script_count } = body;

    // --- DEBUGGING: Log the received marketing_analysis ---
    console.log("Received marketing_analysis:", marketing_analysis);
    // --- END DEBUGGING ---

    // Validate required fields
    if (!original_transcript || !marketing_analysis || !target_platform) {
      return NextResponse.json({ error: 'Missing required fields: original_transcript, marketing_analysis, and target_platform are required.' }, { status: 400 });
    }

    // Validate script_count (optional, default to 1, max 5)
    const count = typeof script_count === 'number' && script_count > 0 && script_count <= 5 ? script_count : 1;

    // --- Construct the prompt for GPT-4o ---
    const prompt = `
        Original Video Transcript:
        ---
        ${original_transcript}
        ---

        Marketing Analysis of the Original Video:
        ---
        ${marketing_analysis}
        ---

        Task:
        Your mission is to transform the "Original Video Transcript" into ${count} compelling short video script${count > 1 ? 's' : ''}, acting as a scriptwriter who understands both storytelling and marketing.
        **Preserve the heart and soul of the original story:** Keep the key narrative elements: Valentin, his grandmother Claudine's recipe inspiration (the story, not necessarily the grandmother herself), the dedication to slow-cooking, the mention of unique bread (like 'pain semoule' if mentioned), the Parisian context, and the feeling of a lovingly prepared, exceptional product ("fond sous la langue").
        **Maintain the authentic and warm tone** of the original. While adapting for video, avoid overly generic or cold marketing language. Inject personality, reflecting the charm of the original text. If there was gentle humor, try to retain a similar lighthearted touch appropriate for the platform "${target_platform}".
        **Use the "Marketing Analysis" as a guide for *enhancements*, not replacements:** Apply the insights from the analysis (clarity, CTA, emotional triggers) to make the original story *more impactful and effective* on video, not to erase its unique character. Strengthen the message and call-to-action *within the context* of this authentic story.
        **Optimize for the platform "${target_platform}"**: Ensure the script's length, pacing, and style are suitable. Include visual cues ([Visual: ...]) that align with the story and tone.
        **Goal:** Create ${count} script${count > 1 ? 's' : ''} that feel like a natural, more potent video evolution of the original text, skillfully balancing storytelling authenticity with marketing effectiveness.

        Output Format:
        Provide each script clearly separated. Do not include any introductory text like "Here are the scripts:".
        Use simple text formatting. Start each script with "Script 1:", "Script 2:", etc. if multiple scripts are requested.

        Example for one script:
        Script 1:
        [Scene description or opening visual]
        Speaker: Hey! Struggling with [problem]? Our new [product] makes it super easy.
        [Visual of product in action]
        Speaker: Just [action] and see the difference. Get yours now! Link in bio! #shortformvideo #[relevant hashtag]

        Example for two scripts:
        Script 1:
        [Visual: Quick cuts showing problem]
        Voiceover: Tired of [pain point]?
        [Visual: Product solving the problem]
        Voiceover: Meet [Product Name]. Simplify your life. Click below to learn more! #[Brand] #[Benefit]

        Script 2:
        [Visual: User happily using the product]
        On-screen text: Before vs After using [Product Name]
        Voiceover (upbeat): Upgrade your [activity] instantly! Shop now via the link! #EasyLife #[ProductName]
        ---
        Generate the script${count > 1 ? 's' : ''}:
        `;
    // --- End Prompt ---


    console.log(`Requesting ${count} script(s) from OpenAI for platform ${target_platform}...`);

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4.5-preview", // Use the desired model
      messages: [
        {
          role: "system",
          content: "You are an expert copywriter specializing in short-form video scripts for social media marketing."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300 * count, // Adjust token limit based on expected script length and count
      n: 1, // We request 'n' variations via the prompt logic, not via the 'n' parameter here
      temperature: 0.7, // Adjust creativity vs. predictability
    });

    const generatedContent = response.choices[0]?.message?.content?.trim();

    if (!generatedContent) {
      console.error("OpenAI response was empty or invalid.");
      return NextResponse.json({ error: 'Failed to generate scripts. OpenAI response was empty.' }, { status: 500 });
    }

    console.log("Raw OpenAI response:", generatedContent);

    // Process the response to extract individual scripts
    // Splitting logic assumes scripts start with "Script X:" or similar, or are separated by newlines
    let scripts: string[];
    if (count > 1) {
        // Try splitting by "Script X:" pattern first
        scripts = generatedContent.split(/\\nScript \\d+:/).map(s => s.trim()).filter(s => s.length > 0);
        // If that doesn't yield enough scripts, try splitting by double newlines as a fallback
        if (scripts.length < count) {
           scripts = generatedContent.split(/\\n\\n+/).map(s => s.trim()).filter(s => s.length > 0);
        }
         // If still not enough, assign the whole content as the first script
         if (scripts.length === 0 && generatedContent.length > 0) {
            scripts = [generatedContent];
        }
    } else {
        scripts = [generatedContent]; // Only one script requested
    }

     // Basic cleanup - remove potential "Script X:" prefixes if they were not used for splitting
    scripts = scripts.map(script => script.replace(/^Script \\d+:\\s*/, '').trim());


    console.log("Parsed generated scripts:", scripts);

    // Return the generated scripts
    return NextResponse.json({ generated_scripts: scripts });

  } catch (error: any) {
    console.error('Error in /api/generate-script:', error);

    // Check if it's an OpenAI API error
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json({ error: `OpenAI API Error: ${error.status} ${error.name} - ${error.message}` }, { status: error.status || 500 });
    }

    // Handle potential JSON parsing error or other errors
     if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body: Failed to parse JSON.' }, { status: 400 });
    }


    // Generic internal server error
    return NextResponse.json({ error: `Internal Server Error: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}

// Optional: Add Edge Runtime configuration if needed
// export const runtime = 'edge'; 
import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

/**
 * Handles POST requests for text translation
 */
export async function POST(request: NextRequest) {
  try {
    // Get text and target language from request body
    const { text, targetLanguage } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Missing text' },
        { status: 400 }
      );
    }

    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'Missing target language' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client with API key
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log(`Translating text to: ${targetLanguage}`);

    // Map language codes to full names for the prompt
    const languageNames: Record<string, string> = {
      'fr': 'French',
      'en': 'English',
      'es': 'Spanish',
      'de': 'German',
      'it': 'Italian',
      'zh': 'Chinese'
    };

    const languageName = languageNames[targetLanguage] || targetLanguage;

    // Create translation prompt
    const prompt = `Translate the following text to ${languageName}, preserving the original tone and style:\n\n${text}`;

    // Call OpenAI API for translation
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a professional translator. Translate the provided text into the requested language." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    // Extract translated text
    const translatedText = response.choices[0]?.message?.content || '';

    console.log('Translation completed');

    // Return translated text
    return NextResponse.json({ translatedText });
  }
  catch (error) {
    console.error('Error during translation:', error);
    return NextResponse.json(
      { error: `Error during translation: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 
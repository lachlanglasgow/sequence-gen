import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { inputText, instruction } = await req.json();

    if (!inputText || !instruction) {
      return NextResponse.json(
        { error: 'Missing inputText or instruction' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Sequence Generator',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'system',
            content: 'You are a prompt engineering assistant. Modify the given prompt according to the instruction. Return ONLY the modified prompt, no explanations.',
          },
          {
            role: 'user',
            content: `Original prompt: "${inputText}"

Instruction: ${instruction}

Return only the modified prompt:`,
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const modifiedText = data.choices?.[0]?.message?.content?.trim();

    if (!modifiedText) {
      throw new Error('No response from LLM');
    }

    return NextResponse.json({
      success: true,
      originalText: inputText,
      modifiedText,
      instruction,
    });
  } catch (error) {
    console.error('Modify prompt error:', error);
    return NextResponse.json(
      { error: 'Failed to modify prompt', details: String(error) },
      { status: 500 }
    );
  }
}

// app/api/autonomous/generate-example/route.ts
// POST endpoint that generates a random campaign description example using Groq LLM.

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[API/autonomous/generate-example] POST received')

  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured')
    }

    const groq = new Groq({ apiKey })

    // Create a diverse prompt by randomly selecting a niche category
    const niches = [
      'educational & learning',
      'fitness & wellness',
      'business & entrepreneurship',
      'tech & gadgets',
      'gaming & esports',
      'lifestyle & DIY',
      'food & cooking',
      'travel & adventure',
      'creative & art',
      'music & entertainment',
      'parenting & family',
      'finance & investing',
      'fashion & beauty',
      'automotive',
      'home improvement',
      'photography & videography',
      'productivity & self-improvement',
      'social commentary & news',
      'anime & pop culture',
      'nature & environment',
    ]

    const selectedNiche = niches[Math.floor(Math.random() * niches.length)]

    const systemPrompt = `You are a creative assistant that generates diverse YouTube channel discovery criteria for business outreach campaigns.

IMPORTANT: Generate completely different and unique examples every time. Each response should be distinct in niche, audience size, geography, and use case.

Generate a single specific example of YouTube channels someone might want to discover. Make it realistic and actionable.

Requirements:
- Pick a channel niche/type (educational, gaming, fitness, tech, food, lifestyle, business, etc.)
- Include a subscriber range (vary widely: some 100 to 1k, some 1k to 10k, some 10k to 100k, some 100k+)
- Add geographic or language preferences (optional but varied)
- Include content style or creator type specifics
- Make each suggestion completely different from previous ones

Vary your suggestions across:
- Different niches (NOT just travel/tech/fitness)
- Different subscriber ranges (don't always pick 10k-100k)
- Different geographic focuses
- Different content styles
- Different business use cases

Generate ONLY the description, no explanations or extra text. Make it unique and diverse.`

    const userPrompts = [
      'Generate a completely unique YouTube channel discovery criteria in the ' + selectedNiche + ' niche.',
      'I need a fresh, creative example of YouTube channels to discover. Make it completely different from travel, fitness, and tech content.',
      'Generate a random, diverse example of YouTube channels for outreach that I have never heard before.',
      'Create a unique channel discovery description for a niche I might not expect. Be creative and different.',
      'Generate an example of YouTube creators to find for outreach, but make it something unconventional and unique.',
    ]

    const selectedUserPrompt = userPrompts[Math.floor(Math.random() * userPrompts.length)]

    const completion = await groq.chat.completions.create({
      model: process.env.AUTONOMOUS_GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: selectedUserPrompt,
        },
      ],
      temperature: 1.0,
      max_tokens: 180,
    })

    const example = completion.choices[0]?.message?.content?.trim() ?? ''

    if (!example) {
      throw new Error('Failed to generate example from LLM')
    }

    console.log('[API/autonomous/generate-example] Generated:', example)

    return NextResponse.json({
      success: true,
      example,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[API/autonomous/generate-example] Error:', detail)

    return NextResponse.json(
      {
        error: 'Failed to generate example',
        detail,
      },
      { status: 500 }
    )
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 })
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { layoutData } = await req.json();

    const systemPrompt = `You are a Lean facility layout coach helping a user optimize their floor plan. You speak in plain language at a 10th grade reading level. You are specific — you name exact zones, exact distances, exact squares. You give 3-5 actionable recommendations ranked by impact. Each recommendation explains WHAT to move, WHERE to move it, and WHY it improves the score. You reference the scoring factors by name. Keep your response under 300 words.`;

    const userPrompt = `Here is my current layout:

Zones:
${layoutData.zones.map((z: any) => `- ${z.activity} (${z.type}): ${z.size.width}x${z.size.height} at position (${z.position.x}, ${z.position.y}) = ${z.area_sq_ft} sq ft`).join('\n')}

Corridors:
${layoutData.corridors.map((c: any) => `- ${c.type} corridor: ${c.width} wide from (${c.start.x}, ${c.start.y}) to (${c.end.x}, ${c.end.y})`).join('\n')}

Doors:
${layoutData.doors.map((d: any) => `- ${d.name} (${d.type}): ${d.inbound_percentage}% inbound, ${d.outbound_percentage}% outbound at (${d.position.x}, ${d.position.y})`).join('\n')}

Volume Distribution:
${layoutData.volumes.map((v: any) => `- ${v.activity}: ${v.percentage}% of volume, typical: ${v.typical_volume} lbs, peak: ${v.peak_volume} lbs, departs at ${v.departure_time}`).join('\n')}

Relationships:
${layoutData.relationships.map((r: any) => `- ${r.activity_a} ↔ ${r.activity_b}: ${r.rating}`).join('\n')}

Current Scores (out of 100 total):
${layoutData.scores.factors.map((f: any) => `- ${f.label}: ${f.score}/${f.maxScore}`).join('\n')}
Total: ${layoutData.scores.total}/100

Grid: ${layoutData.grid.width} x ${layoutData.grid.height} squares (each square = ${layoutData.grid.square_size_ft} ft)

Give me your top recommendations to improve this layout.`;

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const coaching = result.content[0].text;

    return new Response(
      JSON.stringify({ coaching }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in layout-coach function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

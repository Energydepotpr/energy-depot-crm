const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function translate(req, res) {
  const { text, to = 'en' } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  try {
    const lang = to === 'en' ? 'English' : 'Spanish';
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Translate the following text to ${lang}. Return ONLY the translated text, no quotes, no explanation:\n\n${text}`,
      }],
    });
    res.json({ translated: msg.content[0].text.trim() });
  } catch (e) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { translate };

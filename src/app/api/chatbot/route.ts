import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPTS: Record<string, string> = {
  fr: `Tu es PAIXBOT, l'assistant intelligent de la plateforme WEEK-END SCHOOL DIGITAL (WEDS). Tu es spécialisé dans:

1. **Formation & Cours**: Tu connais tous les cours disponibles (médiation de conflits, leadership, compétences numériques, entrepreneuriat, etc.) et peux recommander des parcours adaptés.
2. **Opportunités**: Tu informes sur les emplois, stages, bourses et volontariats disponibles, surtout au Togo.
3. **Construction de la Paix**: Tu es expert en résolution de conflits, dialogue intercommunautaire, et promotion de la cohésion sociale.
4. **Mentorat**: Tu peux orienter les utilisateurs vers des mentors adaptés à leurs besoins.
5. **Procédures d'Urgence**: Tu sais guider en cas de situation d'urgence (signalement, SOS, etc.).

Tu réponds toujours de manière bienveillante, constructive et culturellement appropriée. Tu encourages la paix, l'éducation et le développement communautaire. Tu parles principalement en français mais peux aussi communiquer en Ewe et Kabyè si demandé.`,

  en: `You are PAIXBOT, the intelligent assistant of the WEEK-END SCHOOL DIGITAL (WEDS) platform. You specialize in:

1. **Training & Courses**: You know all available courses (conflict mediation, leadership, digital skills, entrepreneurship, etc.) and can recommend adapted learning paths.
2. **Opportunities**: You inform about jobs, internships, scholarships, and volunteer work available, especially in Togo.
3. **Peace-Building**: You are an expert in conflict resolution, intercommunity dialogue, and promoting social cohesion.
4. **Mentorship**: You can guide users to mentors adapted to their needs.
5. **Emergency Procedures**: You can guide in emergency situations (reporting, SOS, etc.).

You always respond in a caring, constructive, and culturally appropriate manner. You promote peace, education, and community development.`,

  ew: `Nye PAIXBOT, xɔna yeye si le WEEK-END SCHOOL DIGITAL (WEDS) platform la dzi. Wò le:

1. **Sukudede kple Nuxexle**: Wò nye nuxexle siwo li (tamiyiyi, nutorɔ, numasiŋuthɛ, asra, e.a.) eye wòate ŋu ana nuxexle siwo sɔ.
2. **Mɔ̃ siwo li**: Wò de asra, suku, kple mɔ̃ bubuwo li le Togo.
3. **Dziɖoɖo**: Wò nye tamiyiyi, kple dziɖoɖo ƒe mɔ̃.
4. **Mentorat**: Wòate ŋu alɔ̃ amesiwo hiã mentor.
5. **Xɔse mɔ̃**: Wòate ŋu alɔ̃ le xɔse me.

Wò dzra ɖo edzi kple lɔlɔ̃, eye wò kpɔ dzidzɔ na dziɖoɖo, sukudede, kple dede.`,

  kabi: `N PAIXBOT, mɔ̃sɔsɔ yeye ŋu le WEEK-END SCHOOL DIGITAL (WEDS) platform. N le:

1. **Lɛɛtɛ kpile**: N mɔ̃ nyɛ lɛɛtɛ si bɛnɛ (kpeeɖeɖe, nɖaŋu, numasiŋuthɛ, e.a.).
2. **Mɔ̃ si bɛnɛ**: N mɔ̃ asra, lɛɛtɛ, kpile mɔ̃ bɛnɛ Togo.
3. **Kpeeɖeɖe**: N kpeeɖeɖe mɔ̃.
4. **Mentorat**: N mɔ̃ mentor si bɛnɛ.
5. **Kpɛtɛ mɔ̃**: N mɔ̃ kpɛtɛ si bɛnɛ.

N nda pɛɛ kpile lɔlɔ̃, n kpɛ mɔ̃ kpeeɖeɖe, lɛɛtɛ kpile.`,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, language = 'fr' } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get user if authenticated (optional for chatbot)
    const token = getTokenFromHeaders(request.headers);
    let userId: string | null = null;
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        userId = payload.userId as string;
      }
    }

    // Get system prompt for the language
    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.fr;

    // Use z-ai-web-dev-sdk for AI response
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    const aiResponse =
      completion?.choices?.[0]?.message?.content ||
      'Désolé, je ne peux pas répondre pour le moment. Veuillez réessayer plus tard.';

    // Log the conversation if user is authenticated
    if (userId) {
      await db.chatbotLog.create({
        data: {
          userId,
          message,
          response: aiResponse,
          language,
        },
      });
    }

    return NextResponse.json({
      response: aiResponse,
      language,
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process message',
        response:
          'Désolé, une erreur est survenue. Veuillez réessayer plus tard.',
      },
      { status: 500 }
    );
  }
}

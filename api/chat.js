// Vercel 서버리스 함수: 브라우저 대신 서버에서 OpenAI를 호출한다.
// API 키는 Vercel 환경변수(OPENAI_API_KEY)에 저장되어 브라우저에 절대 노출되지 않는다.
// Responses API + web_search 도구를 써서, 최신 정보가 필요하면 모델이 알아서 검색한다.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "서버에 API 키가 설정되지 않았습니다." });
  }

  try {
    const { messages, model } = req.body;

    // 허용된 모델만 쓰도록 검증. 지정 안 하거나 목록에 없으면 저렴한 기본값(Luna)으로.
    const ALLOWED_MODELS = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"];
    const selectedModel = ALLOWED_MODELS.includes(model) ? model : "gpt-5.6-luna";

    // 사용자의 마지막 메시지에 "인스타/고화질/선명하게" 같은 단어가 있으면
    // 이미지 생성 화질을 한 단계 올린다 (기본은 저화질로 비용을 아낌).
    const HQ_KEYWORDS = ["인스타", "인스타그램", "고화질", "고해상도", "선명하게", "선명한", "화질 좋게", "퀄리티 좋게"];
    let lastUserText = "";
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      if (typeof lastUserMsg.content === "string") {
        lastUserText = lastUserMsg.content;
      } else if (Array.isArray(lastUserMsg.content)) {
        const t = lastUserMsg.content.find((p) => p.type === "text");
        lastUserText = t ? t.text : "";
      }
    }
    const wantsHQ = HQ_KEYWORDS.some((k) => lastUserText.includes(k));
    const imageQuality = wantsHQ ? "medium" : "low";

    // chat/completions 형식(messages)을 Responses API 형식(input)으로 변환.
    // system 메시지는 instructions로, 나머지는 input 배열로 넘긴다.
    let instructions = "";
    const input = [];
    for (const m of messages) {
      if (m.role === "system") {
        instructions = typeof m.content === "string" ? m.content : "";
        continue;
      }
      if (typeof m.content === "string") {
        input.push({ role: m.role, content: m.content });
      } else if (Array.isArray(m.content)) {
        // 이미지 포함 메시지: text와 image_url을 Responses 형식으로 변환
        const parts = [];
        for (const p of m.content) {
          if (p.type === "text") {
            parts.push({ type: "input_text", text: p.text });
          } else if (p.type === "image_url") {
            parts.push({ type: "input_image", image_url: p.image_url.url });
          }
        }
        input.push({ role: m.role, content: parts });
      }
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        instructions: instructions,
        input: input,
        tools: [
          { type: "web_search" }, // 모델이 필요하다고 판단하면 자동으로 웹 검색
          { type: "image_generation", quality: imageQuality, size: "1024x1024" },
        ],
        // stream을 끄고 완성된 응답을 한 번에 받는다 (스트리밍 이벤트 형식 문제 회피, 안정성 우선)
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: JSON.stringify(data) });
    }

    // output 배열에서 답변 텍스트와, 생성된 이미지(있다면)를 뽑아낸다.
    let text = "";
    let usedSearch = false;
    let generatedImage = null; // base64 PNG 데이터
    for (const item of data.output || []) {
      if (item.type === "web_search_call") usedSearch = true;
      if (item.type === "image_generation_call" && item.result) {
        generatedImage = item.result; // base64 문자열
      }
      if (item.type === "message" && item.content) {
        for (const c of item.content) {
          if (c.type === "output_text") text += c.text;
        }
      }
    }

    res.status(200).json({ text, usedSearch, generatedImage, imageQuality: generatedImage ? imageQuality : undefined });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

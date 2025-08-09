import OpenAI from "openai";

const CAL_TABLE = {
  banana: 89, apple: 52, orange: 47, strawberry: 33, blueberry: 57,
  tomato: 18, carrot: 41, broccoli: 34, cucumber: 16, potato: 77,
  pizza: 266, cheeseburger: 295, hamburger: 250, hotdog: 290, bagel: 250,
  doughnut: 452, donut: 452, "ice cream": 207, pretzel: 380, croissant: 406,
  muffin: 296, burrito: 206, taco: 226, sushi: 130, "fried rice": 163,
  spaghetti: 158, "french fries": 312, pancake: 227, waffle: 291,
  fruit: 60, vegetable: 35, sandwich: 250, dessert: 300
};
const normalize = (s) => {
  const x = (s || "").toLowerCase().trim();
  const map = { fries:"french fries", donut:"doughnut", "cheese burger":"cheeseburger", burger:"hamburger", icecream:"ice cream" };
  return map[x] ?? x;
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");          // ← allows StackBlitz
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { image, grams = 150 } = req.body || {};
    if (!image || typeof image !== "string") return res.status(400).json({ error: "Missing image (data URL)" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt =
      "Identify the dominant edible food in the image. " +
      "Return strict JSON {label:string, isFood:boolean, confidence:number 0..1}. " +
      "If no food, isFood=false and label='none'.";

    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "FoodDetection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              label: { type: "string" },
              isFood: { type: "boolean" },
              confidence: { type: "number" }
            },
            required: ["label", "isFood", "confidence"],
            additionalProperties: false
          }
        }
      },
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: { url: image } }
        ]
      }]
    });

    // Different SDK versions expose text differently:
    const text = resp.output_text ?? resp.content?.[0]?.text;
    const { label, isFood, confidence } = JSON.parse(text);

    const norm = normalize(label);
    let per100 = CAL_TABLE[norm];
    if (per100 == null) {
      for (const k of Object.keys(CAL_TABLE)) {
        if (norm.includes(k) || k.includes(norm)) { per100 = CAL_TABLE[k]; break; }
      }
    }
    const kcalPer100 = per100 ?? 200;
    const kcalEstimate = Math.round(kcalPer100 * (Number(grams) / 100));
    res.json({ label: norm, isFood, confidence, kcalPer100, kcalEstimate });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}

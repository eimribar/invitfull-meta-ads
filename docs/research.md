# Nano Banana Pro (Gemini 3 Pro Image) - Research Findings

## What Is Nano Banana Pro

- Community nickname for **Gemini 3 Pro Image** (`gemini-3-pro-image-preview`)
- Released by Google DeepMind, November 20, 2025
- **Autoregressive model** (generates images token-by-token like an LLM), NOT diffusion-based
- Text encoder based on **Gemini 3 Pro** — deep language understanding far beyond typical image models
- Supports up to **14 reference images** (6 objects, 5 humans)
- Generates up to **4K resolution** images
- Has a mandatory **"Thinking" step** — reasons through prompts before generating

## System Instructions — Key Findings

### They Work (with caveats)

- Nano Banana Pro **actively supports** the `system_instruction` parameter
- Base Nano Banana (Gemini 2.5 Flash Image) **silently ignores** system instructions
- System instructions **can override user prompts** (confirmed by Max Woolf: set "MUST be black and white" in system instruction, user asked for colorful — result was monochrome)
- Known bug: some users report the model ignoring `system_instruction` (GitHub issue #1742, closed without resolution)
- Pass `system_instruction` directly in `GenerateContentConfig`, not wrapped in a list

### Best Practices for Writing System Instructions

1. **Use Markdown formatting with `# Section Headers`**
   - The model's own internal system prompt uses Markdown (discovered via refrigerator magnets trick)
   - Structure matches how the model was trained to process instructions

2. **Use ALL CAPS + penalty language for critical rules**
   - The model's hidden instructions use ALL CAPS with penalty commands
   - Google's own engineers use this pattern
   - Measurably improves adherence

3. **Be precise and direct — no conversational filler**
   - Gemini 3 may over-analyze verbose or complex prompt engineering techniques
   - Command-line-style syntax > paragraphs

4. **Put negative constraints LAST**
   - Google docs explicitly warn: "the model may drop negative constraints if they appear too early in the prompt"
   - Order: Context → Main instructions → Negative constraints

5. **Avoid broad blanket negatives**
   - Don't write "do not infer" or "do not guess" — model over-indexes
   - Be explicit about what it SHOULD do instead

6. **Keep temperature at 1.0**
   - Google strongly recommends default value
   - Changing it causes "looping or degraded performance"

7. **The "Thinking" step is mandatory**
   - Creates internal 1K prototype first, then upscales to final 2K/4K
   - System instructions feed into this reasoning process

### What the Internal System Prompt Looks Like

Discovered via the "refrigerator magnets" prompt injection technique by Max Woolf:
- Formatted in **Markdown** with section headers
- Contains `# General Principles` sections with numbered points
- Has explicit restrictions against certain buzzwords (to prevent model collapse)
- Uses ALL CAPS penalty commands
- Possible prompt rewriting mechanisms

## Reference Images — How They Work

### No Formal Tagging API

- There is **no dedicated tagging parameter** in the API
- Images are included as sequential elements in the `contents` array
- The model processes them **in order** (positional)
- You label images by placing **text description immediately before each image**

### The Interleaved Pattern

```python
contents = [
    "[LABEL] Description of this image:",
    image_object,
    "[LABEL] Description of this image:",
    image_object,
    "Final instruction text"
]
```

### Best Practices for Reference Images

1. **Label BEFORE the image, not after** — model processes sequentially
2. **Use consistent bracket tag format** — `[LOGO]`, `[BRAND_REF_1]`, `[AD_INSPIRATION]`
3. **State role hierarchy in prompt** — which reference dominates
4. **Keep the primary target image LAST** — model adopts aspect ratio of last image
5. **Don't exceed 14 images total**
6. **Use clear role assignments** — "Image A = subject, Image B = lighting, Image C = background"

### Character/Face Consistency

- Reference image quality is MORE important than the prompt itself
- Requirements: 1024x1024px minimum, even lighting, frontal + 45-degree profile
- Model supports up to 5 simultaneous characters (degrades beyond 2)
- Cannot achieve 100% face consistency — re-interprets features every time
- Identity-locking prompt language helps: "Preserve exact facial structure, eye shape, jawline"

## Advanced Prompt Engineering

### What Works

- **Mention specific camera gear** ("Shot on Canon EOS 90D, 85mm f/1.4") triggers photorealism
- **Compositional anchors** ("Pulitzer-prize-winning cover photo") improve composition
- **JSON and HTML in prompts** — the encoder was trained on code
- **Hex color codes** (#9F2B68) interpreted correctly
- **Font specification** works: "Fira Code", "Helvetica Neue", "Comic Sans"
- **Restate critical requirements** using different phrasing (redundancy helps)
- **More reference images = better** for consistency (17 outperformed 2)

### What Doesn't Work

- Style transfer performed poorly compared to other models (autoregressive architecture resists)
- The mandatory thinking step sometimes "corrects" unusual requests toward realism
- Reference images alone don't guarantee character replication when conflicting with training data

## Model Specs

| Aspect | Base Nano Banana | Nano Banana Pro |
|--------|------------------|-----------------|
| Resolution | 1K (1 MP) | 2K baseline (4 MP); 4K option (16 MP) |
| Text Encoder | Gemini 2.5 Flash | Gemini 3 Pro |
| Thinking | None | Mandatory |
| Token Cost | $0.039/image | $0.134 (2K); $0.24 (4K) |
| System Instructions | Silently ignored | Supported |

## Sources

- [Max Woolf - Nano Banana Prompt Engineering](https://minimaxir.com/2025/11/nano-banana-prompts/)
- [Max Woolf - Nano Banana Pro Review](https://minimaxir.com/2025/12/nano-banana-pro/)
- [Replicate - How to Prompt Nano Banana Pro](https://replicate.com/blog/how-to-prompt-nano-banana-pro)
- [Google AI - Nano Banana Image Generation Docs](https://ai.google.dev/gemini-api/docs/image-generation)
- [Google Cloud - Gemini 3 Prompting Guide](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gemini-3-prompting-guide)
- [Google Cloud - Gemini 3 Pro Image](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image)
- [Google DeepMind - Nano Banana Pro](https://deepmind.google/models/gemini-image/pro/)
- [APIYI - Face Consistency Guide](https://help.apiyi.com/en/nano-banana-pro-face-consistency-guide-en.html)
- [Higgsfield - High-Control Prompting](https://higgsfield.ai/nano-banana-pro-prompt-guide)
- [GitHub Issue - system_instruction not working](https://github.com/googleapis/python-genai/issues/1742)
- [Google Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- [Google Image Understanding Docs](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Google Developers Blog - Prompting for Best Results](https://developers.googleblog.com/en/how-to-prompt-gemini-2-5-flash-image-generation-for-the-best-results/)

import { describe, expect, it } from "vitest";
import { aiLogoName } from "./aiLogos";

const named = (model: string, baseUrl = "http://192.168.1.10:8080/v1") => aiLogoName(model, baseUrl);

describe("aiLogoName", () => {
  it("knows a model by its family, wherever it runs", () => {
    expect(named("qwen3:8b")).toBe("qwen");
    expect(named("qwen/qwen3-8b", "https://openrouter.ai/api/v1")).toBe("qwen");
    expect(named("llama3.2:3b")).toBe("meta");
    expect(named("llava:7b")).toBe("llava");
    expect(named("gemma3:4b")).toBe("gemma");
    expect(named("gpt-4o-mini")).toBe("openai");
    expect(named("o3-mini")).toBe("openai");
    expect(named("phi4:14b")).toBe("microsoft");
    expect(named("mimo-v2.6-flash")).toBe("xiaomimimo");
  });

  it("falls back to the provider, then to nothing", () => {
    expect(named("my-finetune", "http://localhost:11434/v1")).toBe("ollama");
    expect(named("custom", "https://api.openai.com/v1")).toBe("openai");
    expect(named("my-finetune")).toBeNull();
  });

  it("doesn't take a word that merely contains a family name for it", () => {
    expect(named("dolphin-mistral")).toBe("mistral");
    expect(named("graphite-7b")).toBeNull();
  });
});

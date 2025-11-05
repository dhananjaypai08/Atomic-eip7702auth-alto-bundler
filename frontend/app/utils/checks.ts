export function validateEnv(): void {
  const requiredEnvVars: Record<string, string> = {
    NEXT_PUBLIC_PIMLICO_API_KEY: "Pimlico API key required for bundler transactions.",
    NEXT_PUBLIC_PRIVATE_KEY: "Private key required to sign and authorize smart account operations.",
    NEXT_PUBLIC_SIMPLE_ACCOUNT: "Smart account address required to perform delegated transactions.",
    NEXT_PUBLIC_USDC_ADDRESS: "USDC token address required for token transfers and payment flow.",
    NEXT_PUBLIC_ENTRY_POINT: "Entry point address required for EIP-4337 bundler execution.",
  };

  const missing: string[] = [];

  for (const [key, reason] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      console.error(`Missing ${key}: ${reason}`);
      missing.push(`${key} — ${reason}`);
    }
  }

  if (missing.length > 0) {
    const message = [
      "Missing required environment variables:",
      ...missing.map((m) => `  - ${m}`),
    ].join("\n");

    if (typeof window !== "undefined") {
      alert(message);
    } else {
      console.error(message);
    }

    throw new Error("Missing required environment variables.");
  } else {
    console.log("All required environment variables are present.");
  }
}

import fs from "fs";
import path from "path";
import { glob } from "glob";
import type { LoadedContract, ContractSchema, FeatureDescription } from "../types/index.js";

function stripBom(content: string): string {
  return content.replace(/^\uFEFF/, "");
}

export async function readContracts(contractsPath: string): Promise<LoadedContract[]> {
  const absolutePath = path.resolve(contractsPath);

  if (!fs.existsSync(absolutePath)) {
    console.warn(`[contractReader] Contracts path not found: ${absolutePath}`);
    return [];
  }

  const pattern = path.join(absolutePath, "**", "*.contract.json").replace(/\\/g, "/");
  const files = await glob(pattern);

  if (files.length === 0) {
    console.warn(`[contractReader] No *.contract.json files found in: ${absolutePath}`);
    return [];
  }

  const contracts: LoadedContract[] = [];

  for (const filePath of files) {
    try {
      const rawContent = stripBom(fs.readFileSync(filePath, "utf-8"));
      const schema = JSON.parse(rawContent) as ContractSchema;
      const name = path.basename(filePath, ".contract.json");

      contracts.push({ filePath, name, schema });
      console.log(`[contractReader] Loaded contract: ${name}`);
    } catch (err) {
      console.error(`[contractReader] Failed to parse ${filePath}:`, err);
    }
  }

  return contracts;
}

export function readFeatureDescriptions(featuresPath?: string): FeatureDescription[] {
  if (!featuresPath || !fs.existsSync(featuresPath)) {
    return getBuiltinFeatures();
  }

  try {
    const content = stripBom(fs.readFileSync(featuresPath, "utf-8"));
    return JSON.parse(content) as FeatureDescription[];
  } catch {
    return getBuiltinFeatures();
  }
}

function getBuiltinFeatures(): FeatureDescription[] {
  return [
    {
      title: "User Registration",
      description: "User fills registration form with name, email and password and submits it. System validates fields and creates the account.",
      acceptanceCriteria: [
        "Email must be a valid format",
        "Password must be at least 8 characters",
        "All required fields must be filled",
        "Duplicate email should return an error",
        "Successful registration redirects to dashboard",
      ],
    },
    {
      title: "User Login",
      description: "User enters email and password to authenticate. System verifies credentials and returns a session token.",
      acceptanceCriteria: [
        "Invalid credentials show error message",
        "Empty fields show validation errors",
        "Successful login sets auth cookie/token",
        "User is redirected to dashboard after login",
      ],
    },
    {
      title: "API Health Check",
      description: "GET /health endpoint returns system status and version information.",
      acceptanceCriteria: [
        "Returns 200 with status ok",
        "Response includes version field",
        "Response time under 500ms",
      ],
    },
  ];
}

export function summarizeContract(contract: LoadedContract): string {
  const { schema } = contract;
  const parts: string[] = [
    `Module: ${schema.module || contract.name}`,
    `Version: ${schema.version || "unknown"}`,
  ];

  if (schema.endpoint) parts.push(`Endpoint: ${schema.method || "GET"} ${schema.endpoint}`);
  if (schema.request) parts.push(`Request schema: ${JSON.stringify(schema.request).slice(0, 300)}`);
  if (schema.response) parts.push(`Response schema: ${JSON.stringify(schema.response).slice(0, 300)}`);
  if (schema.domain_rules) parts.push(`Domain rules: ${JSON.stringify(schema.domain_rules).slice(0, 200)}`);

  return parts.join("\n");
}

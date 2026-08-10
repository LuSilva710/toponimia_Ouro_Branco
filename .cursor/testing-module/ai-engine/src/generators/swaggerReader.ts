/**
 * swaggerReader — fetches and parses a Swagger/OpenAPI JSON spec,
 * converting each operation into a LoadedContract for the AI test generator.
 *
 * Supports OpenAPI 2.x (swagger) and 3.x.
 * Uses SWAGGER_JSON_URL env var (set by Resolve-RovisRuntimeTargets.ps1).
 */

import type { LoadedContract, ContractSchema } from "../types/index.js";

interface OpenApiSpec {
  swagger?: string;
  openapi?: string;
  info?: { title?: string; version?: string };
  basePath?: string;
  host?: string;
  schemes?: string[];
  paths?: Record<string, PathItem>;
  components?: { schemas?: Record<string, unknown> };
  definitions?: Record<string, unknown>;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  [key: string]: Operation | undefined;
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: {
    content?: Record<string, { schema?: unknown }>;
    required?: boolean;
  };
  responses?: Record<string, { description?: string; content?: unknown }>;
  security?: unknown[];
}

interface Parameter {
  name: string;
  in: "path" | "query" | "header" | "body" | "formData";
  required?: boolean;
  schema?: unknown;
  type?: string;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

async function fetchJson(url: string): Promise<OpenApiSpec> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Swagger fetch failed: HTTP ${response.status} from ${url}`);
  }
  return response.json() as Promise<OpenApiSpec>;
}

function buildContractFromOperation(
  path: string,
  method: string,
  operation: Operation,
  spec: OpenApiSpec
): LoadedContract {
  const operationId =
    operation.operationId ||
    `${method}-${path.replace(/[^a-zA-Z0-9]/g, "-").replace(/^-+|-+$/g, "")}`;

  const tag = (operation.tags?.[0] || "default")
    .toLowerCase()
    .replace(/\s+/g, "-");

  // Extract request body shape
  let requestSchema: Record<string, unknown> | undefined;
  if (operation.requestBody?.content) {
    const jsonContent =
      operation.requestBody.content["application/json"] ||
      Object.values(operation.requestBody.content)[0];
    if (jsonContent?.schema) {
      requestSchema = jsonContent.schema as Record<string, unknown>;
    }
  }

  // v2 body parameter
  const bodyParam = (operation.parameters || []).find((p) => p.in === "body");
  if (!requestSchema && bodyParam?.schema) {
    requestSchema = bodyParam.schema as Record<string, unknown>;
  }

  // Extract response shape (prefer 200/201)
  let responseSchema: Record<string, unknown> | undefined;
  const responses = operation.responses || {};
  const successCode = ["200", "201"].find((c) => responses[c]);
  if (successCode) {
    const successResponse = responses[successCode] as {
      content?: Record<string, { schema?: unknown }>;
      schema?: unknown;
    };
    if (successResponse?.content) {
      const jsonContent =
        successResponse.content["application/json"] ||
        Object.values(successResponse.content)[0];
      responseSchema = (jsonContent as { schema?: Record<string, unknown> })
        ?.schema;
    } else if (successResponse?.schema) {
      responseSchema = successResponse.schema as Record<string, unknown>;
    }
  }

  // Collect path/query params
  const pathParams = (operation.parameters || [])
    .filter((p) => p.in === "path" || p.in === "query")
    .map((p) => ({ name: p.name, in: p.in, required: p.required ?? false }));

  const schema: ContractSchema = {
    version: "1.0.0",
    module: tag,
    endpoint: path,
    method: method.toUpperCase(),
    operationId,
    summary: operation.summary || operation.description || `${method.toUpperCase()} ${path}`,
    ...(requestSchema ? { request: requestSchema } : {}),
    ...(responseSchema ? { response: responseSchema } : {}),
    ...(pathParams.length > 0 ? { parameters: pathParams } : {}),
    requiresAuth: !!(operation.security && operation.security.length > 0),
  };

  return {
    filePath: `swagger://${path}#${method}`,
    name: operationId,
    schema,
  };
}

export async function loadSwaggerContracts(
  swaggerJsonUrl?: string
): Promise<LoadedContract[]> {
  const url = swaggerJsonUrl || process.env.SWAGGER_JSON_URL;

  if (!url) {
    console.log("[swaggerReader] SWAGGER_JSON_URL not set — skipping Swagger import");
    return [];
  }

  console.log(`[swaggerReader] Fetching Swagger spec from: ${url}`);

  let spec: OpenApiSpec;
  try {
    spec = await fetchJson(url);
  } catch (err) {
    console.warn(`[swaggerReader] Failed to fetch Swagger: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  const paths = spec.paths || {};
  const contracts: LoadedContract[] = [];
  let skipped = 0;

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      // Skip health/swagger/metrics endpoints from test generation
      if (/\/(health|metrics|swagger|openapi|favicon)/i.test(path)) {
        skipped++;
        continue;
      }

      try {
        const contract = buildContractFromOperation(path, method, operation, spec);
        contracts.push(contract);
      } catch (err) {
        console.warn(`[swaggerReader] Skipped ${method.toUpperCase()} ${path}: ${err}`);
      }
    }
  }

  console.log(
    `[swaggerReader] Loaded ${contracts.length} operation(s) from Swagger` +
    (skipped > 0 ? ` (${skipped} system endpoints skipped)` : "")
  );

  return contracts;
}

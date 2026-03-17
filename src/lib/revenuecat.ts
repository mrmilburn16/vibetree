/**
 * RevenueCat API v2 client for server-side setup automation.
 * Base URL: https://api.revenuecat.com/v2
 * Auth: Authorization: Bearer <user's RC v2 secret key>
 */

const RC_BASE = "https://api.revenuecat.com/v2";

export interface RCClientOptions {
  secretKey: string;
}

/** RevenueCat API error response shape */
interface RCErrorBody {
  type?: string;
  message?: string;
  param?: string;
  retryable?: boolean;
  doc_url?: string;
}

function getAuthHeaders(secretKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };
}

async function rcFetch(
  secretKey: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${RC_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(secretKey),
      ...(options.headers as Record<string, string>),
    },
  });
  return res;
}

/** Throw with step context and RC error type + message on non-2xx */
function throwIfNotOk(
  res: Response,
  body: unknown,
  step: string
): never {
  const errBody = body as RCErrorBody;
  const type = errBody?.type ?? "unknown";
  const message = errBody?.message ?? res.statusText ?? "Unknown error";
  throw new Error(
    `RevenueCat ${step}: [${type}] ${message}`
  );
}

/** Parse JSON and throw on non-2xx with step context */
async function parseAndThrowIfNotOk<T>(
  res: Response,
  step: string
): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throwIfNotOk(res, body, step);
  }
  return body as T;
}

// --- Response types (minimal fields we need) ---

interface RCProject {
  id: string;
  object?: string;
  name?: string;
}

interface RCApp {
  id: string;
  object?: string;
  name?: string;
  project_id?: string;
}

interface RCPublicApiKey {
  id: string;
  key: string;
  object?: string;
  environment?: string;
  app_id?: string;
}

interface RCList<T> {
  object?: string;
  items: T[];
  next_page?: string;
  url?: string;
}

interface RCProduct {
  id: string;
  object?: string;
  store_identifier?: string;
  type?: string;
  app_id?: string;
  display_name?: string;
}

interface RCEntitlement {
  id: string;
  object?: string;
  lookup_key?: string;
  display_name?: string;
  project_id?: string;
}

interface RCOffering {
  id: string;
  object?: string;
  lookup_key?: string;
  display_name?: string;
  project_id?: string;
}

interface RCPackage {
  id: string;
  object?: string;
  lookup_key?: string;
  display_name?: string;
  position?: number;
}

// --- Client methods ---

export function createRcClient(options: RCClientOptions) {
  const { secretKey } = options;

  return {
    async createProject(name: string): Promise<{ id: string }> {
      console.log("🏪 RC: Creating project...", { name });
      const res = await rcFetch(secretKey, "/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const data = await parseAndThrowIfNotOk<RCProject>(res, "createProject");
      const id = data?.id;
      if (!id) throw new Error("RevenueCat createProject: response missing id");
      return { id };
    },

    async createApp(
      projectId: string,
      params: { name: string; type: "app_store"; bundleId: string }
    ): Promise<{ id: string }> {
      console.log("🏪 RC: Creating app...", {
        projectId,
        name: params.name,
        bundleId: params.bundleId,
      });
      const res = await rcFetch(secretKey, `/projects/${projectId}/apps`, {
        method: "POST",
        body: JSON.stringify({
          name: params.name,
          type: params.type,
          app_store: { bundle_id: params.bundleId },
        }),
      });
      const data = await parseAndThrowIfNotOk<RCApp>(res, "createApp");
      const id = data?.id;
      if (!id) throw new Error("RevenueCat createApp: response missing id");
      return { id };
    },

    async getPublicApiKeys(
      projectId: string,
      appId: string
    ): Promise<{ key: string }> {
      console.log("🏪 RC: Fetching public API keys...", { projectId, appId });
      const res = await rcFetch(
        secretKey,
        `/projects/${projectId}/apps/${appId}/public_api_keys`
      );
      const data = await parseAndThrowIfNotOk<RCList<RCPublicApiKey>>(
        res,
        "getPublicApiKeys"
      );
      const first = data?.items?.[0];
      const key = first?.key;
      if (!key)
        throw new Error(
          "RevenueCat getPublicApiKeys: no key in response (create a public key in RevenueCat dashboard if needed)"
        );
      return { key };
    },

    async createProduct(
      projectId: string,
      params: {
        storeIdentifier: string;
        appId: string;
        type: string;
        displayName: string;
      }
    ): Promise<{ id: string }> {
      console.log("🏪 RC: Creating product...", {
        projectId,
        storeIdentifier: params.storeIdentifier,
        displayName: params.displayName,
      });
      const res = await rcFetch(secretKey, `/projects/${projectId}/products`, {
        method: "POST",
        body: JSON.stringify({
          store_identifier: params.storeIdentifier,
          app_id: params.appId,
          type: params.type,
          display_name: params.displayName,
        }),
      });
      const data = await parseAndThrowIfNotOk<RCProduct>(res, "createProduct");
      const id = data?.id;
      if (!id) throw new Error("RevenueCat createProduct: response missing id");
      return { id };
    },

    async createEntitlement(
      projectId: string,
      params: { lookupKey: string; displayName: string }
    ): Promise<{ id: string }> {
      console.log("🏪 RC: Creating entitlement...", {
        projectId,
        lookupKey: params.lookupKey,
      });
      const res = await rcFetch(
        secretKey,
        `/projects/${projectId}/entitlements`,
        {
          method: "POST",
          body: JSON.stringify({
            lookup_key: params.lookupKey,
            display_name: params.displayName,
          }),
        }
      );
      const data = await parseAndThrowIfNotOk<RCEntitlement>(
        res,
        "createEntitlement"
      );
      const id = data?.id;
      if (!id)
        throw new Error("RevenueCat createEntitlement: response missing id");
      return { id };
    },

    async attachProductsToEntitlement(
      projectId: string,
      entitlementId: string,
      productIds: string[]
    ): Promise<void> {
      console.log("🏪 RC: Attaching products to entitlement...", {
        projectId,
        entitlementId,
        productIds,
      });
      const res = await rcFetch(
        secretKey,
        `/projects/${projectId}/entitlements/${entitlementId}/actions/attach_products`,
        {
          method: "POST",
          body: JSON.stringify({ product_ids: productIds }),
        }
      );
      await parseAndThrowIfNotOk<unknown>(res, "attachProductsToEntitlement");
    },

    async createOffering(
      projectId: string,
      params: { lookupKey: string; displayName: string }
    ): Promise<{ id: string }> {
      console.log("🏪 RC: Creating offering...", {
        projectId,
        lookupKey: params.lookupKey,
      });
      const res = await rcFetch(
        secretKey,
        `/projects/${projectId}/offerings`,
        {
          method: "POST",
          body: JSON.stringify({
            lookup_key: params.lookupKey,
            display_name: params.displayName,
          }),
        }
      );
      const data = await parseAndThrowIfNotOk<RCOffering>(
        res,
        "createOffering"
      );
      const id = data?.id;
      if (!id)
        throw new Error("RevenueCat createOffering: response missing id");
      return { id };
    },

    async createPackage(
      projectId: string,
      offeringId: string,
      params: { lookupKey: string; displayName: string; position: number }
    ): Promise<{ id: string }> {
      console.log("🏪 RC: Creating package...", {
        projectId,
        offeringId,
        lookupKey: params.lookupKey,
      });
      const res = await rcFetch(
        secretKey,
        `/projects/${projectId}/offerings/${offeringId}/packages`,
        {
          method: "POST",
          body: JSON.stringify({
            lookup_key: params.lookupKey,
            display_name: params.displayName,
            position: params.position,
          }),
        }
      );
      const data = await parseAndThrowIfNotOk<RCPackage>(res, "createPackage");
      const id = data?.id;
      if (!id)
        throw new Error("RevenueCat createPackage: response missing id");
      return { id };
    },

    /** Attach products to a package. API expects products array with product_id and eligibility_criteria. */
    async attachProductsToPackage(
      projectId: string,
      packageId: string,
      productIds: string[]
    ): Promise<void> {
      console.log("🏪 RC: Attaching products to package...", {
        projectId,
        packageId,
        productIds,
      });
      const products = productIds.map((product_id) => ({
        product_id,
        eligibility_criteria: "all" as const,
      }));
      const res = await rcFetch(
        secretKey,
        `/projects/${projectId}/packages/${packageId}/actions/attach_products`,
        {
          method: "POST",
          body: JSON.stringify({ products }),
        }
      );
      await parseAndThrowIfNotOk<unknown>(res, "attachProductsToPackage");
    },
  };
}

// --- High-level orchestrator ---

export interface SetupRevenueCatParams {
  secretKey: string;
  projectName: string;
  appName: string;
  bundleId: string;
  products: Array<{
    storeIdentifier: string;
    displayName: string;
    lookupKey: string;
    position: number;
  }>;
}

export interface SetupRevenueCatResult {
  projectId: string;
  appId: string;
  publicApiKey: string;
  entitlementId: string;
  offeringId: string;
  productIds: string[];
  packageIds: string[];
}

/** Error with optional step for API to return which RevenueCat step failed */
export type SetupRevenueCatError = Error & { step?: string };

export async function setupRevenueCat(
  params: SetupRevenueCatParams
): Promise<SetupRevenueCatResult> {
  const client = createRcClient({ secretKey: params.secretKey });
  const { projectName, appName, bundleId, products } = params;

  if (!products.length) {
    const err = new Error(
      "RevenueCat setup: at least one product is required"
    ) as SetupRevenueCatError;
    err.step = "validate";
    throw err;
  }

  let step = "createProject";
  try {
    const { id: projectId } = await client.createProject(projectName);

    step = "createApp";
    const { id: appId } = await client.createApp(projectId, {
      name: appName,
      type: "app_store",
      bundleId,
    });

    step = "getPublicApiKeys";
    const { key: publicApiKey } =
      await client.getPublicApiKeys(projectId, appId);

    step = "createProduct";
    const productIds: string[] = [];
    for (const p of products) {
      const { id } = await client.createProduct(projectId, {
        storeIdentifier: p.storeIdentifier,
        appId,
        type: "subscription",
        displayName: p.displayName,
      });
      productIds.push(id);
    }

    step = "createEntitlement";
    const { id: entitlementId } = await client.createEntitlement(projectId, {
      lookupKey: "premium",
      displayName: "Premium access",
    });

    step = "attachProductsToEntitlement";
    await client.attachProductsToEntitlement(
      projectId,
      entitlementId,
      productIds
    );

    step = "createOffering";
    const { id: offeringId } = await client.createOffering(projectId, {
      lookupKey: "default",
      displayName: "Default Offering",
    });

    step = "createPackage + attachProductsToPackage";
    const packageIds: string[] = [];
    // productIds[i] corresponds to products[i]
    const lookupKeyToProductId = new Map(
      products.map((p, i) => [p.lookupKey, productIds[i]])
    );
    const sortedProducts = [...products].sort(
      (a, b) => a.position - b.position
    );
    for (const p of sortedProducts) {
      const productId = lookupKeyToProductId.get(p.lookupKey);
      if (!productId) continue;
      const { id: packageId } = await client.createPackage(
        projectId,
        offeringId,
        {
          lookupKey: p.lookupKey,
          displayName: p.displayName,
          position: p.position,
        }
      );
      await client.attachProductsToPackage(projectId, packageId, [
        productId,
      ]);
      packageIds.push(packageId);
    }

    return {
      projectId,
      appId,
      publicApiKey,
      entitlementId,
      offeringId,
      productIds,
      packageIds,
    };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    (e as SetupRevenueCatError).step = step;
    throw e;
  }
}

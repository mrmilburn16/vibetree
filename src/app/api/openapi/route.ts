/**
 * GET /api/openapi
 * OpenAPI 3.0 spec for public API.
 */
import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.0",
  info: {
    title: "VibeTree API",
    version: "1.0.0",
    description: "Build and ship iOS apps with AI.",
  },
  servers: [{ url: "/api", description: "API base" }],
  paths: {
    "/projects": {
      get: {
        summary: "List projects",
        tags: ["Projects"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "List of projects",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    projects: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          bundleId: { type: "string" },
                          createdAt: { type: "number" },
                          updatedAt: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create project",
        tags: ["Projects"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  id: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Created project" },
        },
      },
    },
    "/projects/{id}": {
      get: {
        summary: "Get project",
        tags: ["Projects"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Project" },
          404: { description: "Not found" },
        },
      },
      patch: {
        summary: "Update project",
        tags: ["Projects"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  bundleId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated project" },
        },
      },
      delete: {
        summary: "Delete project",
        tags: ["Projects"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Deleted" },
        },
      },
    },
    "/projects/{id}/export": {
      get: {
        summary: "Export project source",
        tags: ["Projects"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "projectType", in: "query", schema: { type: "string", enum: ["standard", "pro"] } },
        ],
        responses: {
          200: { description: "Swift source file" },
        },
      },
    },
    "/projects/{id}/export-zip": {
      get: {
        summary: "Export full project as ZIP",
        tags: ["Projects"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "ZIP file" },
        },
      },
    },
    "/projects/import": {
      post: {
        summary: "Import project from ZIP",
        tags: ["Projects"],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: { file: { type: "string", format: "binary" } },
              },
            },
            "application/json": {
              schema: {
                type: "object",
                properties: { zip: { type: "string", description: "Base64-encoded ZIP" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Created project" },
        },
      },
    },
    "/events": {
      post: {
        summary: "Track analytics event",
        tags: ["Analytics"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", enum: ["page_view", "sign_in", "project_create", "message_sent", "build_completed", "export"] },
                  properties: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Recorded" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Firebase ID token",
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}

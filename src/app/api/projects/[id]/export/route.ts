import { NextResponse } from "next/server";
import { getProjectFiles, getProjectFilePaths } from "@/lib/projectFileStore";

/**
 * GET /api/projects/[id]/export
 * Returns the project's source as a downloadable file.
 * When projectType=pro (query), only includes .swift files. Otherwise includes all stored files.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const projectType = url.searchParams.get("projectType") === "pro" ? "pro" : "standard";

  let paths = getProjectFilePaths(id);
  if (projectType === "pro") {
    paths = paths.filter((p) => p.endsWith(".swift"));
  }

  let swiftContent: string;

  if (paths.length > 0) {
    const files = getProjectFiles(id)!;
    swiftContent = paths
      .map(
        (path) =>
          `// --- ${path} ---\n\n${files[path] ?? ""}`
      )
      .join("\n\n");
  } else {
    swiftContent = `// Vibetree export — ${id}
// No generated source yet. Describe your app in the editor to generate Swift.

import SwiftUI

@main
struct VibetreeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("Hello from Vibetree")
                .font(.title)
            Text("Describe your app in the editor to generate Swift, then export again.")
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
`;
  }

  return new NextResponse(swiftContent, {
    status: 200,
    headers: {
      "Content-Type": "text/x-swift",
      "Content-Disposition": `attachment; filename="Vibetree-${id.slice(0, 20)}.swift"`,
    },
  });
}

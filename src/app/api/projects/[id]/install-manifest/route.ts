import { NextRequest, NextResponse } from "next/server";
import { hasProjectIPA } from "@/lib/ipaStore";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  if (!hasProjectIPA(projectId)) {
    return NextResponse.json(
      { error: "No IPA available for this project. Build first." },
      { status: 404 }
    );
  }

  const host = _req.headers.get("host") || "localhost:3001";
  const proto = _req.headers.get("x-forwarded-proto") || "https";
  const ipaURL = `${proto}://${host}/api/projects/${projectId}/ipa`;

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${ipaURL}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>com.vibetree.app.${projectId}</string>
        <key>bundle-version</key>
        <string>1.0</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>VibeTree App</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;

  return new NextResponse(manifest, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
      "Cache-Control": "no-cache",
    },
  });
}

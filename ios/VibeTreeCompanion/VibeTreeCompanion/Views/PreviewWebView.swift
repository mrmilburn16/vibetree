import SwiftUI
import WebKit

struct PreviewWebView: View {
    let projectId: String
    @State private var previewURL: URL?
    @State private var isLoading = true
    @State private var loadError: String?

    var body: some View {
        VStack(spacing: 0) {
            if let url = previewURL {
                DeviceFrameView {
                    WebViewRepresentable(url: url, isLoading: $isLoading)
                }
                .padding(Forest.space4)
            } else if let error = loadError {
                errorState(error)
            } else {
                loadingState
            }
        }
        .background(Forest.backgroundPrimary)
        .task {
            await loadPreviewURL()
        }
    }

    private var loadingState: some View {
        VStack(spacing: Forest.space4) {
            ProgressView()
                .tint(Forest.accent)
            Text("Loading preview…")
                .font(Forest.font(size: Forest.textSm))
                .foregroundColor(Forest.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Forest.space4) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(Forest.font(size: 32))
                .foregroundColor(Forest.warning)
            Text("Preview unavailable")
                .font(Forest.font(size: Forest.textLg, weight: .semibold))
                .foregroundColor(Forest.textSecondary)
            Text(message)
                .font(Forest.font(size: Forest.textSm))
                .foregroundColor(Forest.textTertiary)
                .multilineTextAlignment(.center)
        }
        .padding(Forest.space6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func loadPreviewURL() async {
        do {
            let baseURL = (UserDefaults.standard.string(forKey: "serverURL") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if baseURL.isEmpty {
                loadError = "Set Server URL in Settings"
            } else if let url = URL(string: "\(baseURL)/api/projects/\(projectId)/run-on-device") {
                previewURL = url
            } else {
                loadError = "Invalid server URL"
            }
        }
        isLoading = false
    }
}

// MARK: - WKWebView Wrapper

struct WebViewRepresentable: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(Forest.backgroundPrimary)
        webView.scrollView.backgroundColor = UIColor(Forest.backgroundPrimary)
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(isLoading: $isLoading)
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        @Binding var isLoading: Bool

        init(isLoading: Binding<Bool>) {
            _isLoading = isLoading
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoading = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            isLoading = false
        }
    }
}

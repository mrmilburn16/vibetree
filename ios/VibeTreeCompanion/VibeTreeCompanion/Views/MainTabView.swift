import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Tab = .projects

    enum Tab: String {
        case projects, builds, settings
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            ProjectListView()
                .tabItem {
                    Label("Projects", systemImage: "square.grid.2x2.fill")
                }
                .tag(Tab.projects)

            ContentView()
                .tabItem {
                    Label("Builds", systemImage: "hammer.fill")
                }
                .tag(Tab.builds)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
                .tag(Tab.settings)
        }
        .tint(Forest.accent)
        .preferredColorScheme(.dark)
    }
}

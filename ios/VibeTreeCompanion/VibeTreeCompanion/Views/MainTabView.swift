import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Tab = .projects
    @Environment(\.scenePhase) private var scenePhase

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
        .onChange(of: selectedTab) { _, newTab in
            if newTab == .projects {
                Task { await ProjectService.shared.fetchProjects() }
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active, selectedTab == .projects {
                Task { await ProjectService.shared.fetchProjects() }
            }
        }
    }
}

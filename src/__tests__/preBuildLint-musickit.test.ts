/**
 * Ensures preBuildLint catches MusicKit library-playlist issues (e.g. using Album
 * instead of Song when adding to a playlist) so we can "run a test" without a device.
 * Combined with musickit-skill-auth and musickit-export tests, this validates that
 * the system guides and checks for correct library playlist code.
 */
import { describe, it, expect } from "vitest";
import { preBuildLint } from "@/lib/preBuildLint";
import { detectRequiredFrameworks } from "@/lib/xcodeProject";

const GOOD_LIBRARY_PLAYLIST_SWIFT = `
import SwiftUI
import MusicKit

@Observable class ViewModel {
    var songs: [Song] = []
    func buildAndSavePlaylist(name: String) async {
        let playlist = try await MusicLibrary.shared.createPlaylist(name: name, description: nil, authorDisplayName: nil)
        for song in songs {
            try await MusicLibrary.shared.add(song, to: playlist)
        }
    }
}
`;

const BAD_LIBRARY_PLAYLIST_ALBUM_SWIFT = `
import SwiftUI
import MusicKit

@Observable class ViewModel {
    var albums: [Album] = []
    func addToPlaylist(_ playlist: Playlist) async {
        for album in albums {
            try await MusicLibrary.shared.add(album, to: playlist)
        }
    }
}
`;

const BAD_LIBRARY_PLAYLIST_ALBUM_VAR_SWIFT = `
import SwiftUI
import MusicKit

func save(playlist: Playlist, album: Album) async {
    try await MusicLibrary.shared.add(album, to: playlist)
}
`;

describe("preBuildLint — MusicKit library playlist", () => {
  it("does not warn when only Song is used with MusicLibrary.add/createPlaylist", () => {
    const files = [{ path: "ViewModel.swift", content: GOOD_LIBRARY_PLAYLIST_SWIFT }];
    const result = preBuildLint(files);
    const musicLibraryWarnings = result.warnings.filter((w) =>
      /MusicLibrary|No catalogID|Album/.test(w.message)
    );
    expect(musicLibraryWarnings).toHaveLength(0);
  });

  it("warns when Album is passed to MusicLibrary.add (for album in ... add(album, to:))", () => {
    const files = [{ path: "ViewModel.swift", content: BAD_LIBRARY_PLAYLIST_ALBUM_SWIFT }];
    const result = preBuildLint(files);
    const musicLibraryWarnings = result.warnings.filter((w) =>
      /MusicLibrary|No catalogID|Album|Song from MusicCatalogSearchRequest/.test(w.message)
    );
    expect(musicLibraryWarnings.length).toBeGreaterThanOrEqual(1);
    expect(musicLibraryWarnings.some((w) => /catalogID|libraryID|Album|Song/.test(w.message))).toBe(true);
  });

  it("warns when add(album, to: playlist) is used", () => {
    const files = [{ path: "Save.swift", content: BAD_LIBRARY_PLAYLIST_ALBUM_VAR_SWIFT }];
    const result = preBuildLint(files);
    const musicLibraryWarnings = result.warnings.filter((w) =>
      /MusicLibrary|No catalogID|Album|Song from MusicCatalogSearchRequest/.test(w.message)
    );
    expect(musicLibraryWarnings.length).toBeGreaterThanOrEqual(1);
  });
});

describe("MusicKit framework detection with MusicLibrary only", () => {
  it("detects MusicKit when Swift uses only MusicLibrary.createPlaylist/add", () => {
    const files = [{ path: "ViewModel.swift", content: GOOD_LIBRARY_PLAYLIST_SWIFT }];
    const frameworks = detectRequiredFrameworks(files);
    expect(frameworks).toContain("MusicKit");
  });
});

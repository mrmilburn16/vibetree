"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Fingerprint,
  Smartphone,
  Layers,
  Info,
  RotateCcw,
} from "lucide-react";
import { Modal, Button, Input, DropdownSelect } from "@/components/ui";
import { updateProject, type Project } from "@/lib/projects";
import type { SelectOption } from "@/components/ui";

const XCODE_TEAM_ID_PREFIX = "vibetree-xcode-team-id:";
const XCODE_BUNDLE_ID_OVERRIDE_PREFIX = "vibetree-xcode-bundle-id:";
const XCODE_PREFERRED_DEVICE_PREFIX = "vibetree-xcode-preferred-device:";
const PROJECT_SETTINGS_PREFIX = "vibetree-project-settings:";
const UNIVERSAL_DEFAULTS_KEY = "vibetree-universal-defaults";

const IOS_TARGET_OPTIONS: SelectOption[] = [
  { value: "17.0", label: "iOS 17.0" },
  { value: "17.2", label: "iOS 17.2" },
  { value: "18.0", label: "iOS 18.0" },
  { value: "18.1", label: "iOS 18.1" },
  { value: "26.0", label: "iOS 26 (Liquid Glass)" },
];

const ORIENTATION_OPTIONS: SelectOption[] = [
  { value: "all", label: "All orientations" },
  { value: "portrait", label: "Portrait only" },
  { value: "landscape", label: "Landscape only" },
];

const DEVICE_FAMILY_OPTIONS: SelectOption[] = [
  { value: "1", label: "iPhone only" },
  { value: "1,2", label: "iPhone & iPad" },
  { value: "2", label: "iPad only" },
];

interface UniversalDefaults {
  teamId: string;
  preferredRunDevice: string;
  deploymentTarget: string;
  orientation: string;
  deviceFamily: string;
}

const FACTORY_DEFAULTS: UniversalDefaults = {
  teamId: "",
  preferredRunDevice: "",
  deploymentTarget: "17.0",
  orientation: "all",
  deviceFamily: "1,2",
};

function loadUniversalDefaults(): UniversalDefaults {
  if (typeof window === "undefined") return { ...FACTORY_DEFAULTS };
  try {
    const raw = localStorage.getItem(UNIVERSAL_DEFAULTS_KEY);
    if (!raw) return { ...FACTORY_DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      teamId: typeof parsed.teamId === "string" ? parsed.teamId : "",
      preferredRunDevice: typeof parsed.preferredRunDevice === "string" ? parsed.preferredRunDevice : "",
      deploymentTarget: typeof parsed.deploymentTarget === "string" ? parsed.deploymentTarget : "17.0",
      orientation: typeof parsed.orientation === "string" ? parsed.orientation : "all",
      deviceFamily: typeof parsed.deviceFamily === "string" ? parsed.deviceFamily : "1,2",
    };
  } catch {
    return { ...FACTORY_DEFAULTS };
  }
}

function saveUniversalDefaults(defaults: UniversalDefaults) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UNIVERSAL_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {}
}

interface ProjectSettings {
  teamId: string;
  preferredRunDevice: string;
  bundleIdOverride: string;
  deploymentTarget: string;
  orientation: string;
  deviceFamily: string;
  overrides: Record<string, boolean>;
}

type UniversalKey = keyof UniversalDefaults;
const UNIVERSAL_KEYS: UniversalKey[] = ["teamId", "preferredRunDevice", "deploymentTarget", "orientation", "deviceFamily"];

function loadSettings(projectId: string, universalDefaults: UniversalDefaults): ProjectSettings {
  const settings: ProjectSettings = {
    teamId: universalDefaults.teamId,
    preferredRunDevice: universalDefaults.preferredRunDevice,
    bundleIdOverride: "",
    deploymentTarget: universalDefaults.deploymentTarget,
    orientation: universalDefaults.orientation,
    deviceFamily: universalDefaults.deviceFamily,
    overrides: {},
  };
  if (typeof window === "undefined") return settings;
  try {
    const teamIdStored = localStorage.getItem(`${XCODE_TEAM_ID_PREFIX}${projectId}`);
    if (teamIdStored !== null && teamIdStored !== "") {
      settings.teamId = teamIdStored;
      settings.overrides.teamId = true;
    }
    const preferredDeviceStored = localStorage.getItem(`${XCODE_PREFERRED_DEVICE_PREFIX}${projectId}`);
    if (preferredDeviceStored !== null && preferredDeviceStored !== "") {
      settings.preferredRunDevice = preferredDeviceStored;
      settings.overrides.preferredRunDevice = true;
    }
    settings.bundleIdOverride = localStorage.getItem(`${XCODE_BUNDLE_ID_OVERRIDE_PREFIX}${projectId}`) ?? "";
    const raw = localStorage.getItem(`${PROJECT_SETTINGS_PREFIX}${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const overrides = typeof parsed.overrides === "object" && parsed.overrides ? parsed.overrides : {};
      if (parsed.deploymentTarget && overrides.deploymentTarget) {
        settings.deploymentTarget = parsed.deploymentTarget;
        settings.overrides.deploymentTarget = true;
      }
      if (parsed.orientation && overrides.orientation) {
        settings.orientation = parsed.orientation;
        settings.overrides.orientation = true;
      }
      if (parsed.deviceFamily && overrides.deviceFamily) {
        settings.deviceFamily = parsed.deviceFamily;
        settings.overrides.deviceFamily = true;
      }
    }
  } catch {}
  return settings;
}

function saveSettings(projectId: string, settings: ProjectSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${XCODE_TEAM_ID_PREFIX}${projectId}`, settings.teamId);
    localStorage.setItem(`${XCODE_PREFERRED_DEVICE_PREFIX}${projectId}`, settings.preferredRunDevice);
    localStorage.setItem(`${XCODE_BUNDLE_ID_OVERRIDE_PREFIX}${projectId}`, settings.bundleIdOverride);
    localStorage.setItem(
      `${PROJECT_SETTINGS_PREFIX}${projectId}`,
      JSON.stringify({
        deploymentTarget: settings.deploymentTarget,
        orientation: settings.orientation,
        deviceFamily: settings.deviceFamily,
        overrides: settings.overrides,
      })
    );
  } catch {}
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 pb-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--background-tertiary)] text-[var(--button-primary-bg)]">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
      </div>
    </div>
  );
}

function HelpTip({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--text-tertiary)]">
      <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function InheritedBadge({ isOverridden, onReset }: { isOverridden: boolean; onReset: () => void }) {
  if (isOverridden) {
    return (
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--background-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--button-primary-bg)] hover:text-[var(--link-default)]"
        title="Reset to your default"
      >
        <RotateCcw className="h-2.5 w-2.5" aria-hidden />
        Overridden — reset
      </button>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
      From your defaults
    </span>
  );
}

export function ProjectSettingsModal({
  isOpen,
  onClose,
  project,
  onProjectUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onProjectUpdate: (updates: { name?: string; bundleId?: string }) => void;
}) {
  const [name, setName] = useState(project.name);
  const [bundleId, setBundleId] = useState(project.bundleId);
  const [nameError, setNameError] = useState("");
  const [bundleError, setBundleError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  const [universalDefaults, setUniversalDefaults] = useState<UniversalDefaults>(() => loadUniversalDefaults());
  const [settings, setSettings] = useState<ProjectSettings>(() => loadSettings(project.id, universalDefaults));

  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setBundleId(project.bundleId);
      setNameError("");
      setBundleError("");
      const ud = loadUniversalDefaults();
      setUniversalDefaults(ud);
      setSettings(loadSettings(project.id, ud));
    }
  }, [isOpen, project.name, project.bundleId, project.id]);

  const isValidBundleId = (value: string) =>
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value);

  function updateUniversalField(key: UniversalKey, value: string) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value, overrides: { ...prev.overrides } };
      delete next.overrides[key];
      saveSettings(project.id, next);
      return next;
    });
    setUniversalDefaults((prev) => {
      const next = { ...prev, [key]: value };
      saveUniversalDefaults(next);
      return next;
    });
  }

  function overrideField(key: UniversalKey, value: string) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value, overrides: { ...prev.overrides, [key]: true } };
      saveSettings(project.id, next);
      return next;
    });
  }

  function resetToDefault(key: UniversalKey) {
    setSettings((prev) => {
      const next = { ...prev, [key]: universalDefaults[key], overrides: { ...prev.overrides } };
      delete next.overrides[key];
      saveSettings(project.id, next);
      return next;
    });
  }

  function handleUniversalOrOverride(key: UniversalKey, value: string) {
    if (settings.overrides[key]) {
      overrideField(key, value);
    } else {
      updateUniversalField(key, value);
    }
  }

  function markAsOverride(key: UniversalKey) {
    setSettings((prev) => {
      const next = { ...prev, overrides: { ...prev.overrides, [key]: true } };
      saveSettings(project.id, next);
      return next;
    });
  }

  function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    let valid = true;
    if (!name.trim()) {
      setNameError("Project name is required.");
      valid = false;
    } else {
      setNameError("");
    }
    if (!isValidBundleId(bundleId.trim())) {
      setBundleError("Use a valid bundle ID (e.g. com.yourcompany.appname).");
      valid = false;
    } else {
      setBundleError("");
    }
    if (!valid) return;

    updateProject(project.id, { name: name.trim(), bundleId: bundleId.trim() });
    onProjectUpdate({ name: name.trim(), bundleId: bundleId.trim() });
    saveSettings(project.id, settings);
    onClose();
  }

  async function handleDownloadSource() {
    setExportLoading(true);
    try {
      const pt =
        typeof window !== "undefined" && localStorage.getItem("vibetree-project-type") === "pro"
          ? "pro"
          : "standard";
      const res = await fetch(`/api/projects/${project.id}/export?projectType=${pt}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vibetree-${project.id.slice(0, 20)}.swift`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Project settings"
      dialogClassName="max-w-xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="project-settings-form" variant="primary">
            Save
          </Button>
        </>
      }
    >
      <form
        id="project-settings-form"
        onSubmit={handleSave}
        className="space-y-6"
      >
        {/* ── Identity (always per-project) ── */}
        <section>
          <SectionHeader
            icon={Fingerprint}
            title="Identity"
            description="Name and bundle identifier for your app"
          />
          <div className="space-y-3 pl-11">
            <div>
              <label htmlFor="project-name" className="mb-1.5 block text-sm text-[var(--text-secondary)]">
                Display name
              </label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My app"
              />
              {nameError && (
                <p className="mt-1 text-sm text-[var(--semantic-error)]">{nameError}</p>
              )}
              <HelpTip>This name appears under the app icon on the home screen.</HelpTip>
            </div>
            <div>
              <label htmlFor="bundle-id" className="mb-1.5 block text-sm text-[var(--text-secondary)]">
                Bundle identifier
              </label>
              <Input
                id="bundle-id"
                value={bundleId}
                onChange={(e) => setBundleId(e.target.value)}
                placeholder="com.yourcompany.appname"
              />
              {bundleError && (
                <p className="mt-1 text-sm text-[var(--semantic-error)]">{bundleError}</p>
              )}
              <HelpTip>Unique reverse-DNS identifier for the App Store. Must be globally unique.</HelpTip>
            </div>
          </div>
        </section>

        <div className="border-t border-[var(--border-default)]" />

        {/* ── Signing (universal, overridable) ── */}
        <section>
          <SectionHeader
            icon={Shield}
            title="Signing"
            description="Apple Developer team for code signing"
          />
          <div className="space-y-3 pl-11">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="team-id" className="text-sm text-[var(--text-secondary)]">
                  Team ID
                </label>
                <InheritedBadge
                  isOverridden={!!settings.overrides.teamId}
                  onReset={() => resetToDefault("teamId")}
                />
              </div>
              <Input
                id="team-id"
                value={settings.teamId}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                  handleUniversalOrOverride("teamId", v);
                }}
                placeholder="ABCDE12345"
                inputMode="text"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <HelpTip>
                Your 10-character Apple Developer Team ID. Set it once and it applies to all projects. Find it in Xcode → Signing &amp; Capabilities → Team, or search for <span className="font-mono">DEVELOPMENT_TEAM</span> in any .xcodeproj file.
              </HelpTip>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="preferred-device" className="text-sm text-[var(--text-secondary)]">
                  Preferred run device
                </label>
                <InheritedBadge
                  isOverridden={!!settings.overrides.preferredRunDevice}
                  onReset={() => resetToDefault("preferredRunDevice")}
                />
              </div>
              <Input
                id="preferred-device"
                value={settings.preferredRunDevice}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  handleUniversalOrOverride("preferredRunDevice", v);
                }}
                placeholder="e.g. iPhone (9)"
                inputMode="text"
                autoCapitalize="none"
                spellCheck={false}
              />
              <HelpTip>
                Your physical iPhone or device name as shown in Xcode’s device dropdown. When you open the project in Xcode, select this device once so Xcode remembers it and stops defaulting to the simulator.
              </HelpTip>
            </div>
            <div>
              <label htmlFor="bundle-override" className="mb-1.5 block text-sm text-[var(--text-secondary)]">
                Bundle ID override
              </label>
              <Input
                id="bundle-override"
                value={settings.bundleIdOverride}
                onChange={(e) => {
                  setSettings((prev) => {
                    const next = { ...prev, bundleIdOverride: e.target.value.trim() };
                    saveSettings(project.id, next);
                    return next;
                  });
                }}
                placeholder="com.yourcompany.appname"
                inputMode="text"
                autoCapitalize="none"
                spellCheck={false}
              />
              <HelpTip>
                Override the bundle ID above for builds. Leave blank to use the project bundle ID.
              </HelpTip>
            </div>
          </div>
        </section>

        <div className="border-t border-[var(--border-default)]" />

        {/* ── Deployment (universal, overridable) ── */}
        <section>
          <SectionHeader
            icon={Smartphone}
            title="Deployment"
            description="Target iOS version and supported devices"
          />
          <div className="space-y-3 pl-11">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-sm text-[var(--text-secondary)]">
                  Minimum iOS version
                </label>
                <InheritedBadge
                  isOverridden={!!settings.overrides.deploymentTarget}
                  onReset={() => resetToDefault("deploymentTarget")}
                />
              </div>
              <DropdownSelect
                options={IOS_TARGET_OPTIONS}
                value={settings.deploymentTarget}
                onChange={(v) => handleUniversalOrOverride("deploymentTarget", v)}
                aria-label="Minimum iOS deployment target"
              />
              <HelpTip>
                The oldest iOS version your app supports. iOS 26 enables Liquid Glass effects.
              </HelpTip>
              {!settings.overrides.deploymentTarget && (
                <button
                  type="button"
                  onClick={() => markAsOverride("deploymentTarget")}
                  className="mt-1 text-[10px] text-[var(--link-default)] hover:underline"
                >
                  Override for this project only
                </button>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-sm text-[var(--text-secondary)]">
                  Supported devices
                </label>
                <InheritedBadge
                  isOverridden={!!settings.overrides.deviceFamily}
                  onReset={() => resetToDefault("deviceFamily")}
                />
              </div>
              <DropdownSelect
                options={DEVICE_FAMILY_OPTIONS}
                value={settings.deviceFamily}
                onChange={(v) => handleUniversalOrOverride("deviceFamily", v)}
                aria-label="Supported device family"
              />
              {!settings.overrides.deviceFamily && (
                <button
                  type="button"
                  onClick={() => markAsOverride("deviceFamily")}
                  className="mt-1 text-[10px] text-[var(--link-default)] hover:underline"
                >
                  Override for this project only
                </button>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-sm text-[var(--text-secondary)]">
                  Interface orientation
                </label>
                <InheritedBadge
                  isOverridden={!!settings.overrides.orientation}
                  onReset={() => resetToDefault("orientation")}
                />
              </div>
              <DropdownSelect
                options={ORIENTATION_OPTIONS}
                value={settings.orientation}
                onChange={(v) => handleUniversalOrOverride("orientation", v)}
                aria-label="Interface orientation"
              />
              {!settings.overrides.orientation && (
                <button
                  type="button"
                  onClick={() => markAsOverride("orientation")}
                  className="mt-1 text-[10px] text-[var(--link-default)] hover:underline"
                >
                  Override for this project only
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="border-t border-[var(--border-default)]" />

        {/* ── Export ── */}
        <section>
          <SectionHeader
            icon={Layers}
            title="Export"
            description="Download source or Xcode project"
          />
          <div className="space-y-3 pl-11">
            <div>
              <span className="mb-1 block text-sm text-[var(--text-secondary)]">App icon</span>
              <p className="text-xs text-[var(--text-tertiary)]">Generate with AI (coming soon) or upload an image.</p>
            </div>
            <Button type="button" variant="secondary" onClick={handleDownloadSource} disabled={exportLoading} className="gap-2">
              <DownloadIcon />
              {exportLoading ? "Preparing…" : "Download source"}
            </Button>
            <HelpTip>
              Downloads your project as a Swift file. Open in Xcode to build and run on your device.
            </HelpTip>
          </div>
        </section>
      </form>
    </Modal>
  );
}

"use client";

import * as Sentry from "@sentry/nextjs";
import { useState, useEffect } from "react";
import {
  Fingerprint,
  Smartphone,
  Info,
} from "lucide-react";
import { Modal, Button, Input, DropdownSelect } from "@/components/ui";
import { updateProject, type Project } from "@/lib/projects";
import type { SelectOption } from "@/components/ui";

const XCODE_PREFERRED_DEVICE_PREFIX = "vibetree-xcode-preferred-device:";

type RunnerDevicesResponse = {
  connected: boolean;
  runnerId: string | null;
  updatedAt: number | null;
  physical: Array<{ name: string }>;
  simulators: Array<{ name: string }>;
};

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

const isValidBundleId = (value: string) =>
  /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value);

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
  const [preferredDevice, setPreferredDevice] = useState("");
  const [runnerDevices, setRunnerDevices] = useState<RunnerDevicesResponse | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(project.name);
    setBundleId(project.bundleId);
    setNameError("");
    setBundleError("");
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(`${XCODE_PREFERRED_DEVICE_PREFIX}${project.id}`) ?? ""
        : "";
    setPreferredDevice(stored);
  }, [isOpen, project.name, project.bundleId, project.id]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setDevicesLoading(true);
    fetch("/api/macos/devices", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data === "object") setRunnerDevices(data as RunnerDevicesResponse);
      })
      .catch((err) => Sentry.captureException(err))
      .finally(() => {
        if (!cancelled) setDevicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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

    if (typeof window !== "undefined") {
      localStorage.setItem(`${XCODE_PREFERRED_DEVICE_PREFIX}${project.id}`, preferredDevice);
    }
    updateProject(project.id, { name: name.trim(), bundleId: bundleId.trim() });
    onProjectUpdate({ name: name.trim(), bundleId: bundleId.trim() });
    onClose();
  }

  const deviceOptions: SelectOption[] = runnerDevices
    ? [
        { value: "__header_device__", label: "My device", disabled: true },
        ...(runnerDevices.physical.length > 0
          ? runnerDevices.physical.map((d) => ({ value: d.name, label: d.name }))
          : [{ value: "__none_device__", label: "No device detected", disabled: true }]),
        { value: "__header_sim__", label: "Simulators", disabled: true },
        ...(runnerDevices.simulators.length > 0
          ? runnerDevices.simulators.slice(0, 25).map((d) => ({ value: d.name, label: d.name }))
          : [{ value: "__none_sim__", label: "No simulators detected", disabled: true }]),
      ]
    : [];

  const detectedDeviceValue =
    runnerDevices &&
    preferredDevice &&
    (runnerDevices.physical.some((d) => d.name === preferredDevice) ||
      runnerDevices.simulators.some((d) => d.name === preferredDevice))
      ? preferredDevice
      : runnerDevices?.physical[0]?.name ??
        runnerDevices?.simulators[0]?.name ??
        "__none_device__";

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
        {/* ── Identity ── */}
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

        {/* ── Preferred run device ── */}
        <section>
          <SectionHeader
            icon={Smartphone}
            title="Preferred run device"
            description="Which device to target when building and installing"
          />
          <div className="space-y-3 pl-11">
            {runnerDevices?.connected && deviceOptions.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Detected from Mac runner{runnerDevices.runnerId ? ` (${runnerDevices.runnerId})` : ""}.
                  </p>
                  {devicesLoading && (
                    <p className="text-xs text-[var(--text-tertiary)]">Refreshing…</p>
                  )}
                </div>
                <DropdownSelect
                  options={deviceOptions}
                  value={detectedDeviceValue}
                  onChange={(v) => setPreferredDevice(v)}
                  aria-label="Preferred run device"
                  className="w-full"
                />
              </div>
            )}
            <div>
              <label htmlFor="preferred-device" className="mb-1.5 block text-sm text-[var(--text-secondary)]">
                Device name
              </label>
              <Input
                id="preferred-device"
                value={preferredDevice}
                onChange={(e) => setPreferredDevice(e.target.value)}
                placeholder="e.g. iPhone (9)"
                inputMode="text"
                autoCapitalize="none"
                spellCheck={false}
              />
              <HelpTip>
                Your physical iPhone or simulator name as shown in Xcode's device dropdown. Select your iPhone once in Xcode and it will remember it for future runs.
              </HelpTip>
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
}

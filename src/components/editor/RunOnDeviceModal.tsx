"use client";

import { Modal, Button } from "@/components/ui";

export function RunOnDeviceModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Run on your iPhone">
      <div className="space-y-4">
        <p className="text-body-muted text-sm">
          Plug your iPhone into your Mac and open our desktop installer. When you click &ldquo;Run on device&rdquo; in the editor, the app will install to your iPhone.
        </p>
        <p className="text-body-muted text-sm">
          Don&apos;t have a Mac? Get a TestFlight link instead—we&apos;ll build your app and send you a link to install it on your iPhone.
        </p>
        <div className="flex gap-2 pt-2">
          <Button variant="primary" type="button">
            Get TestFlight link
          </Button>
          <Button variant="secondary" type="button">
            Download desktop agent for Mac
          </Button>
        </div>
      </div>
    </Modal>
  );
}

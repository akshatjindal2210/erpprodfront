"use client";

import { Settings, Barcode, Keyboard, QrCode } from "lucide-react";
import Drawer from "@/core/components/ui/Drawer";
import { useDeviceScanSettings } from "@/core/hooks/useDeviceScanSettings";

function SettingToggle({ icon: Icon, title, description, checked, onChange, accent = "indigo", iconClass = "text-slate-600" }) {
  const onClass =
    accent === "emerald"
      ? "bg-emerald-600"
      : accent === "amber"
        ? "bg-amber-500"
        : "bg-indigo-600";

  const iconWrapClass =
    accent === "emerald"
      ? "bg-emerald-50 border-emerald-200"
      : accent === "amber"
        ? "bg-amber-50 border-amber-200"
        : "bg-indigo-50 border-indigo-200";

  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/80">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${iconWrapClass}`}>
          <Icon size={15} className={iconClass} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? onClass : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

export default function DeviceSettingsModal({ open, onClose }) {
  const {
    laserScan,
    keyboardType,
    phoneQrScan,
    setLaserScan,
    setKeyboardType,
    setPhoneQrScan,
  } = useDeviceScanSettings();

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Device Settings"
      description="Scan options are saved on this device only"
      headerVariant="form"
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end w-full">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
          <Settings size={14} />
          <span>Choose how you want to scan in the app</span>
        </div>

        <SettingToggle
          icon={Barcode}
          title="Laser scanner"
          description="Hardware laser / barcode gun — open screen and press scanner button."
          checked={laserScan}
          onChange={setLaserScan}
          accent="emerald"
          iconClass="text-emerald-600"
        />

        <SettingToggle
          icon={Keyboard}
          title="Keyboard type"
          description="Type box or location code manually and press Enter."
          checked={keyboardType}
          onChange={setKeyboardType}
          iconClass="text-indigo-600"
        />

        <SettingToggle
          icon={QrCode}
          title="Phone QR scan"
          description="Show camera scan button on phone — same QR icon used in scan screens."
          checked={phoneQrScan}
          onChange={setPhoneQrScan}
          accent="amber"
          iconClass="text-amber-600"
        />

        <p className="text-[10px] text-slate-400 px-1 pt-1">
          These settings stay on this device only (local storage). They are not saved to your account.
        </p>
      </div>
    </Drawer>
  );
}

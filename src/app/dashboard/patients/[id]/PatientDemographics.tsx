"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DemographicsData = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  address: string;
};

type Props = {
  patientId: string;
  initialData: DemographicsData;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "—";
  const last4 = digits.slice(-4).padStart(4, "0");
  return `•••-•••-${last4}`;
}

export default function PatientDemographics({ patientId, initialData }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [data, setData] = useState<DemographicsData>(initialData);
  const [form, setForm] = useState<DemographicsData>(initialData);
  const [toast, setToast] = useState<ToastState>(null);

  const hasPhone = useMemo(() => !!data.phone.trim(), [data.phone]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (field: keyof DemographicsData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/demographics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to update demographics");

      const updated: DemographicsData = {
        firstName: payload.firstName ?? "",
        lastName: payload.lastName ?? "",
        phone: payload.phone ?? "",
        email: payload.email ?? "",
        dateOfBirth: payload.dateOfBirth ?? "",
        address: payload.address ?? "",
      };

      setData(updated);
      setForm(updated);
      setIsEditing(false);
      showToast("success", "Patient demographics updated");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update demographics";
      showToast("error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(data);
    setIsEditing(false);
  };

  const handleResendWelcome = async () => {
    const confirmed = window.confirm("Send welcome SMS to this patient now?");
    if (!confirmed) return;

    setIsResending(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/resend-welcome`, {
        method: "POST",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to send welcome SMS");
      showToast("success", "Welcome SMS sent");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send welcome SMS";
      showToast("error", message);
    } finally {
      setIsResending(false);
    }
  };

  const displayData = isEditing ? form : data;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 m-0">Demographics & Contact</h2>
        </div>
        <div className="flex items-center gap-2">
          {hasPhone && !isEditing && (
            <button
              type="button"
              onClick={handleResendWelcome}
              disabled={isResending}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isResending ? "Sending..." : "Resend Welcome SMS"}
            </button>
          )}
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#212070] text-white hover:bg-[#191860] transition-colors"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#212070] text-white hover:bg-[#191860] transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First name">
          <ValueOrInput
            isEditing={isEditing}
            value={displayData.firstName}
            onChange={(value) => handleChange("firstName", value)}
          />
        </Field>
        <Field label="Last name">
          <ValueOrInput
            isEditing={isEditing}
            value={displayData.lastName}
            onChange={(value) => handleChange("lastName", value)}
          />
        </Field>
        <Field label="Phone">
          <ValueOrInput
            isEditing={isEditing}
            type="tel"
            value={isEditing ? displayData.phone : maskPhone(displayData.phone)}
            onChange={(value) => handleChange("phone", value)}
          />
        </Field>
        <Field label="Email">
          <ValueOrInput
            isEditing={isEditing}
            type="email"
            value={displayData.email}
            onChange={(value) => handleChange("email", value)}
          />
        </Field>
        <Field label="Date of birth">
          <ValueOrInput
            isEditing={isEditing}
            type="date"
            value={displayData.dateOfBirth}
            onChange={(value) => handleChange("dateOfBirth", value)}
          />
        </Field>
        <Field label="Address">
          <ValueOrInput
            isEditing={isEditing}
            value={displayData.address}
            onChange={(value) => handleChange("address", value)}
          />
        </Field>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-sm ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide m-0">{label}</p>
      {children}
    </div>
  );
}

function ValueOrInput({
  isEditing,
  value,
  onChange,
  type = "text",
}: {
  isEditing: boolean;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  if (!isEditing) {
    return <p className="text-sm text-gray-900 m-0 min-h-[20px]">{value || "—"}</p>;
  }

  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#212070]/20 focus:border-[#212070]/40"
    />
  );
}

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Edit2,
  ChevronUp,
  ChevronDown,
  ImageIcon,
  X,
  CheckCircle2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Sponsor {
  id: number;
  sponsorName: string;
  donationType: string | null;
  blurb: string | null;
  logoUrl: string | null;
  isActive: boolean;
  displayOrder: number;
}

interface SponsorSettingsPanelProps {
  roomCode: string;
  directorPin: string;
}

async function resizeImageToBase64(file: File, maxSize = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png", 0.9));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

const BLANK_FORM = {
  sponsorName: "",
  donationType: "",
  blurb: "",
  logoUrl: "" as string | null,
};

export function SponsorSettingsPanel({ roomCode, directorPin }: SponsorSettingsPanelProps) {
  const [enabled, setEnabled] = useState(false);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const fetchSponsors = async () => {
    try {
      const res = await fetch(`/api/tournaments/${roomCode}/sponsors`);
      if (!res.ok) return;
      const data = await res.json();
      setEnabled(data.sponsorPagesEnabled ?? false);
      setSponsors(data.sponsors ?? []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSponsors();
  }, [roomCode]);

  const handleToggleEnabled = async (val: boolean) => {
    setEnabled(val);
    try {
      await apiRequest("PATCH", `/api/tournaments/${roomCode}/sponsor-pages`, {
        directorPin,
        enabled: val,
      });
    } catch {
      setEnabled(!val);
    }
  };

  const handleOpenNew = () => {
    setForm(BLANK_FORM);
    setEditingId("new");
  };

  const handleOpenEdit = (s: Sponsor) => {
    setForm({
      sponsorName: s.sponsorName,
      donationType: s.donationType ?? "",
      blurb: s.blurb ?? "",
      logoUrl: s.logoUrl ?? null,
    });
    setEditingId(s.id);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const base64 = await resizeImageToBase64(file);
      setForm((f) => ({ ...f, logoUrl: base64 }));
      toast({ title: "Logo ready", description: "Click Save to apply it to this sponsor." });
    } catch {
      toast({ title: "Could not process image", description: "Try a different file format (PNG or JPG).", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleSaveForm = async () => {
    if (!form.sponsorName.trim()) return;
    setIsSaving(true);
    try {
      const body = {
        directorPin,
        sponsorName: form.sponsorName.trim(),
        donationType: form.donationType.trim() || null,
        blurb: form.blurb.trim() || null,
        logoUrl: form.logoUrl || null,
      };

      if (editingId === "new") {
        const res = await apiRequest("POST", `/api/tournaments/${roomCode}/sponsors`, body);
        const data = await res.json();
        setSponsors((prev) => [...prev, data.sponsor]);
      } else if (typeof editingId === "number") {
        const res = await apiRequest("PUT", `/api/tournaments/${roomCode}/sponsors/${editingId}`, body);
        const data = await res.json();
        setSponsors((prev) => prev.map((s) => (s.id === editingId ? data.sponsor : s)));
      }
      setEditingId(null);
      toast({
        title: "Sponsor saved",
        description: form.logoUrl ? "Name, logo, and details saved successfully." : "Sponsor saved. You can add a logo by editing it.",
      });
    } catch (err) {
      console.error("Failed to save sponsor:", err);
      toast({
        title: "Could not save sponsor",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (sponsor: Sponsor) => {
    const updated = { ...sponsor, isActive: !sponsor.isActive };
    setSponsors((prev) => prev.map((s) => (s.id === sponsor.id ? updated : s)));
    try {
      await apiRequest("PUT", `/api/tournaments/${roomCode}/sponsors/${sponsor.id}`, {
        directorPin,
        sponsorName: sponsor.sponsorName,
        donationType: sponsor.donationType,
        blurb: sponsor.blurb,
        logoUrl: sponsor.logoUrl,
        isActive: !sponsor.isActive,
      });
    } catch {
      setSponsors((prev) => prev.map((s) => (s.id === sponsor.id ? sponsor : s)));
    }
  };

  const handleDelete = async (id: number) => {
    setSponsors((prev) => prev.filter((s) => s.id !== id));
    setDeleteId(null);
    try {
      await apiRequest("DELETE", `/api/tournaments/${roomCode}/sponsors/${id}`, { directorPin });
    } catch {
      fetchSponsors();
    }
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const newSponsors = [...sponsors];
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= newSponsors.length) return;
    [newSponsors[index], newSponsors[swapIdx]] = [newSponsors[swapIdx], newSponsors[index]];
    setSponsors(newSponsors);
    try {
      await apiRequest("POST", `/api/tournaments/${roomCode}/sponsors/reorder`, {
        directorPin,
        orderedIds: newSponsors.map((s) => s.id),
      });
    } catch {
      fetchSponsors();
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-2">Loading sponsors...</p>;
  }

  return (
    <div className="space-y-3">
      {/* Enable toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
        <div>
          <p className="text-sm font-medium">Sponsor Pages</p>
          <p className="text-xs text-muted-foreground">
            Show sponsor cards to players before they start
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggleEnabled}
          data-testid="switch-sponsor-pages-enabled"
        />
      </div>

      {/* Sponsor list */}
      <div className="space-y-2">
        {sponsors.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No sponsors added yet
          </p>
        ) : (
          sponsors.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
              data-testid={`sponsor-row-${s.id}`}
            >
              {/* Logo thumbnail */}
              <div className="w-8 h-8 rounded shrink-0 bg-muted flex items-center justify-center overflow-hidden">
                {s.logoUrl ? (
                  <img src={s.logoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.sponsorName}</p>
                {s.donationType && (
                  <p className="text-xs text-muted-foreground truncate">{s.donationType}</p>
                )}
              </div>

              {/* Active toggle */}
              <Switch
                checked={s.isActive}
                onCheckedChange={() => handleToggleActive(s)}
                data-testid={`switch-sponsor-active-${s.id}`}
              />

              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => handleMove(i, -1)}
                  disabled={i === 0}
                  data-testid={`button-sponsor-up-${s.id}`}
                >
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => handleMove(i, 1)}
                  disabled={i === sponsors.length - 1}
                  data-testid={`button-sponsor-down-${s.id}`}
                >
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </div>

              {/* Edit / Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleOpenEdit(s)}
                data-testid={`button-edit-sponsor-${s.id}`}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => setDeleteId(s.id)}
                data-testid={`button-delete-sponsor-${s.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={handleOpenNew}
        data-testid="button-add-sponsor"
      >
        <Plus className="w-4 h-4" />
        Add Sponsor
      </Button>

      {/* Add/Edit Dialog */}
      <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId === "new" ? "Add Sponsor" : "Edit Sponsor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Sponsor Name *</Label>
              <Input
                value={form.sponsorName}
                onChange={(e) => setForm((f) => ({ ...f, sponsorName: e.target.value }))}
                placeholder="e.g. Acme Golf Supply"
                data-testid="input-sponsor-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Sponsorship Type</Label>
              <Input
                value={form.donationType}
                onChange={(e) => setForm((f) => ({ ...f, donationType: e.target.value }))}
                placeholder="e.g. Gold Sponsor, Hole 7 Sponsor"
                data-testid="input-sponsor-type"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Message / Blurb</Label>
              <Textarea
                value={form.blurb}
                onChange={(e) => setForm((f) => ({ ...f, blurb: e.target.value }))}
                placeholder="A short message or tagline..."
                className="resize-none"
                rows={3}
                data-testid="input-sponsor-blurb"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Logo</Label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
                data-testid="input-sponsor-logo-file"
              />
              {form.logoUrl ? (
                <div className="relative inline-block">
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className="max-h-28 max-w-full rounded-md border object-contain"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground rounded-full"
                    onClick={() => setForm((f) => ({ ...f, logoUrl: null }))}
                    data-testid="button-remove-logo"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  data-testid="button-upload-logo"
                >
                  <ImageIcon className="w-4 h-4" />
                  {isUploadingLogo ? "Processing..." : "Upload Logo"}
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveForm}
              disabled={isSaving || !form.sponsorName.trim()}
              data-testid="button-save-sponsor"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Sponsor?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove this sponsor from the tournament.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && handleDelete(deleteId)}
              data-testid="button-confirm-delete-sponsor"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

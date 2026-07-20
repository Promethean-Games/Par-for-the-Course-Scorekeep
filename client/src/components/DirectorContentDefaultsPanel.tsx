import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, FileText, HelpCircle, User, Mail, Phone, ImageIcon, PlayCircle, GripVertical } from "lucide-react";

interface DirectorContentDefaultsPanelProps {
  directorPin: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

const EMPTY_FAQ: FaqItem = {
  question: "",
  answer: "",
};

export function DirectorContentDefaultsPanel({ directorPin }: DirectorContentDefaultsPanelProps) {
  const [rulesText, setRulesText] = useState("");
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [directorName, setDirectorName] = useState("");
  const [directorEmail, setDirectorEmail] = useState("");
  const [directorPhone, setDirectorPhone] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [newGalleryImageUrl, setNewGalleryImageUrl] = useState("");
  const [draggedGalleryIndex, setDraggedGalleryIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    fetch(`/api/director/content-defaults?directorPin=${encodeURIComponent(directorPin)}`)
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Could not load content defaults");
        }
        return response.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setRulesText(typeof data.rulesText === "string" ? data.rulesText : "");
        setFaqItems(Array.isArray(data.faqItems) ? data.faqItems : []);
        setDirectorName(typeof data.directorName === "string" ? data.directorName : "");
        setDirectorEmail(typeof data.directorEmail === "string" ? data.directorEmail : "");
        setDirectorPhone(typeof data.directorPhone === "string" ? data.directorPhone : "");
        setHeroImageUrl(typeof data.heroImageUrl === "string" ? data.heroImageUrl : "");
        setYoutubeUrl(typeof data.youtubeUrl === "string" ? data.youtubeUrl : "");
        setGalleryImages(Array.isArray(data.galleryImages) ? data.galleryImages : []);
      })
      .catch((error) => {
        console.error("Failed to load director content defaults:", error);
        if (isMounted) {
          toast({ title: "Could not load content defaults", variant: "destructive" });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [directorPin, toast]);

  const handleAddFaq = () => {
    setFaqItems((prev) => [...prev, { ...EMPTY_FAQ }]);
  };

  const handleUpdateFaq = (index: number, field: keyof FaqItem, value: string) => {
    setFaqItems((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const handleRemoveFaq = (index: number) => {
    setFaqItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleAddGalleryImage = () => {
    const url = newGalleryImageUrl.trim();
    if (!url) return;
    setGalleryImages((prev) => [...prev, url]);
    setNewGalleryImageUrl("");
  };

  const handleRemoveGalleryImage = (indexToRemove: number) => {
    setGalleryImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleDropGalleryImage = (toIndex: number) => {
    if (draggedGalleryIndex === null || draggedGalleryIndex === toIndex) return;
    setGalleryImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedGalleryIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggedGalleryIndex(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        directorPin,
        rulesText: rulesText.trim() || null,
        faqItems: faqItems
          .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
          .filter((item) => item.question && item.answer),
        directorName: directorName.trim() || null,
        directorEmail: directorEmail.trim() || null,
        directorPhone: directorPhone.trim() || null,
        heroImageUrl: heroImageUrl.trim() || null,
        youtubeUrl: youtubeUrl.trim() || null,
        galleryImages: galleryImages.map((url) => url.trim()).filter(Boolean),
      };

      const response = await fetch("/api/director/content-defaults", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Could not save content defaults");
      }

      const saved = await response.json();
      setRulesText(typeof saved.rulesText === "string" ? saved.rulesText : "");
      setFaqItems(Array.isArray(saved.faqItems) ? saved.faqItems : []);
      setDirectorName(typeof saved.directorName === "string" ? saved.directorName : "");
      setDirectorEmail(typeof saved.directorEmail === "string" ? saved.directorEmail : "");
      setDirectorPhone(typeof saved.directorPhone === "string" ? saved.directorPhone : "");
      setHeroImageUrl(typeof saved.heroImageUrl === "string" ? saved.heroImageUrl : "");
      setYoutubeUrl(typeof saved.youtubeUrl === "string" ? saved.youtubeUrl : "");
      setGalleryImages(Array.isArray(saved.galleryImages) ? saved.galleryImages : []);
      toast({ title: "Director defaults saved" });
    } catch (error) {
      console.error("Failed to save director content defaults:", error);
      toast({
        title: "Could not save defaults",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Card className="p-4 text-sm text-muted-foreground">Loading defaults...</Card>;
  }

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Global Event Defaults</h2>
        <p className="text-sm text-muted-foreground mt-1">
          These defaults are the source of truth for your contact info, rules, and FAQ. They auto-apply to all new tournaments and appear on every live event page.
        </p>
      </div>

      {/* Director Contact Info */}
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center gap-2 font-medium">
          <User className="w-4 h-4" />
          Director Contact Info
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Shown publicly on event pages. Auto-fills when you create a new tournament.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="director-default-name" className="flex items-center gap-1">
              <User className="w-3 h-3" /> Director Name
            </Label>
            <Input
              id="director-default-name"
              value={directorName}
              onChange={(e) => setDirectorName(e.target.value)}
              placeholder="Tournament Director"
              data-testid="input-director-default-name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="director-default-email" className="flex items-center gap-1">
              <Mail className="w-3 h-3" /> Email
            </Label>
            <Input
              id="director-default-email"
              type="email"
              value={directorEmail}
              onChange={(e) => setDirectorEmail(e.target.value)}
              placeholder="director@example.com"
              data-testid="input-director-default-email"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="director-default-phone" className="flex items-center gap-1">
              <Phone className="w-3 h-3" /> Phone
            </Label>
            <Input
              id="director-default-phone"
              value={directorPhone}
              onChange={(e) => setDirectorPhone(e.target.value)}
              placeholder="(000) 000-0000"
              data-testid="input-director-default-phone"
            />
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2 font-medium">
          <FileText className="w-4 h-4" />
          Tournament Rules
        </div>
        <Label htmlFor="director-default-rules">Rules Text</Label>
        <Textarea
          id="director-default-rules"
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
          placeholder="Paste the standard tournament rules text here"
          rows={8}
          data-testid="textarea-director-default-rules"
        />
      </div>

      {/* Media */}
      <div className="rounded-lg border p-3 space-y-3">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <ImageIcon className="w-4 h-4" />
            Shared Event Media
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            This media appears across your live event pages and is managed here from the Settings tab.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="director-default-hero-image">Hero Image URL</Label>
          <Input
            id="director-default-hero-image"
            type="url"
            value={heroImageUrl}
            onChange={(e) => setHeroImageUrl(e.target.value)}
            placeholder="https://images.example.com/tournament-banner.jpg"
            data-testid="input-director-default-hero-image"
          />
          {heroImageUrl && (
            <div className="h-24 overflow-hidden rounded border bg-muted">
              <img src={heroImageUrl} alt="Director default hero" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="director-default-youtube" className="flex items-center gap-1">
            <PlayCircle className="w-3 h-3" /> YouTube Video URL
          </Label>
          <Input
            id="director-default-youtube"
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            data-testid="input-director-default-youtube"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="director-default-gallery-image">Gallery Images</Label>
          <div className="flex gap-2">
            <Input
              id="director-default-gallery-image"
              type="url"
              value={newGalleryImageUrl}
              onChange={(e) => setNewGalleryImageUrl(e.target.value)}
              placeholder="https://.../image.jpg"
              data-testid="input-director-default-gallery-image"
            />
            <Button type="button" variant="outline" onClick={handleAddGalleryImage}>
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Drag and drop to reorder the gallery.</p>
          {galleryImages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gallery images added yet.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto rounded-md border p-2">
              {galleryImages.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  draggable
                  onDragStart={() => setDraggedGalleryIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropGalleryImage(index)}
                  className="flex items-center gap-2 rounded border bg-background p-2"
                  data-testid={`director-gallery-item-${index + 1}`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                    <img src={url} alt={`Gallery ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-xs">#{index + 1} {url}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveGalleryImage(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-medium">
              <HelpCircle className="w-4 h-4" />
              Tournament FAQ
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              These are the live FAQs shown on your public event pages. Edit, add, or remove them one item at a time here.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleAddFaq} data-testid="button-add-faq-item">
            <Plus className="w-4 h-4 mr-1" />
            Add FAQ
          </Button>
        </div>

        {faqItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No FAQ items added yet.</p>
        ) : (
          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <div key={`faq-${index}`} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Question #{index + 1}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveFaq(index)}
                    data-testid={`button-remove-faq-${index}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Input
                  value={item.question}
                  onChange={(e) => handleUpdateFaq(index, "question", e.target.value)}
                  placeholder="Enter a common question"
                  data-testid={`input-faq-question-${index}`}
                />
                <Textarea
                  value={item.answer}
                  onChange={(e) => handleUpdateFaq(index, "answer", e.target.value)}
                  placeholder="Enter the answer"
                  rows={4}
                  data-testid={`input-faq-answer-${index}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-director-content-defaults">
          {isSaving ? "Saving..." : "Save Defaults"}
        </Button>
      </div>
    </Card>
  );
}

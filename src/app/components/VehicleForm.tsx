import { useState, useEffect, useRef } from "react";
import { supabase, Vehicle } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { AlertCircle, LoaderCircle, Upload, Trash2 } from "lucide-react";
import { FipeSearch } from "./FipeSearch";
import { FipeVehicle } from "../../hooks/useFipe";
import { motion } from "motion/react";
import { toast } from "sonner";
import { CAR_BRANDS } from "../../constants/carBrands";
import { deleteVehicleImage, thumbUrl, uploadVehicleImage } from "../../services/storage.service";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type VehicleFormProps = {
  open?: boolean;
  vehicle?: Vehicle | null;
  onClose: () => void;
};

type VehiclePhoto = { id: string; url: string; uploading: boolean; newUpload: boolean };
const createPhoto = (url: string): VehiclePhoto => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, url, uploading: false, newUpload: false });

const selectClass =
  "w-full h-9 px-3 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

const initialFormData = {
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  version: "",
  purchase_price: "",
  sale_price: "",
  fipe_code: "",
  images: [] as string[],
  status: "disponivel" as "disponivel" | "em_negociacao" | "vendido",
  color: "",
  plate: "",
  mileage: "",
  fuel_type: "",
  transmission: "",
  description: "",
};

const formatBRLInput = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMileage = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const parseMileage = (value: string) => value.replace(/\D/g, '');

const parseBRLInput = (value: string) => {
  const clean = value.trim().replace(/[^\d,.-]/g, '');
  if (!clean) return Number.NaN;
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(clean) ? clean.replace(/\./g, '') : clean;
  return Number(normalized);
};

const normalizeFuel = (value: string) => {
  const fuel = value.toLocaleLowerCase('pt-BR');
  if (fuel.includes('híbr') || fuel.includes('hibr') || fuel.includes('/ elétr') || fuel.includes('/ eletric')) return 'hibrido';
  if (fuel.includes('elétr') || fuel.includes('eletric')) return 'eletrico';
  if (fuel.includes('flex')) return 'flex';
  if (fuel.includes('diesel')) return 'diesel';
  if (fuel.includes('álcool') || fuel.includes('alcool') || fuel.includes('etanol')) return 'etanol';
  if (fuel.includes('gasolina')) return 'gasolina';
  return '';
};

const inferTransmission = (model: string) => {
  const value = model.toLocaleLowerCase('pt-BR');
  if (/\bcvt\b|multitronic/.test(value)) return 'cvt';
  if (/powershift|\bi-motion\b|easytronic|automatizad|\bdct\b/.test(value)) return 'automatizada';
  if (/\baut\.?\b|autom[aá]tic|\bat\b|tiptronic|steptronic|\bdsg\b/.test(value)) return 'automatica';
  if (/\bmanual\b/.test(value)) return 'manual';
  return '';
};

export function VehicleForm({ open = true, vehicle, onClose }: VehicleFormProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [pendingImageUploads, setPendingImageUploads] = useState(0);
  const cancelledImageUploads = useRef(new Set<string>());
  const imagesToDeleteAfterSave = useRef(new Set<string>());
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (open) {
      setError("");
      setLoading(false);
      setPendingImageUploads(0);
      cancelledImageUploads.current.clear();
      imagesToDeleteAfterSave.current.clear();
      if (vehicle) {
        setFormData({
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          version: vehicle.version || "",
          purchase_price: formatBRLInput(vehicle.purchase_price),
          sale_price: formatBRLInput(vehicle.sale_price),
          fipe_code: vehicle.fipe_code || "",
          images: vehicle.images || [],
          status: vehicle.status,
          color: vehicle.color || "",
          plate: vehicle.plate || "",
          mileage: vehicle.mileage != null ? formatMileage(vehicle.mileage) : "",
          fuel_type: vehicle.fuel_type || "",
          transmission: vehicle.transmission || "",
          description: vehicle.description || "",
        });
        setPhotos((vehicle.images || []).map(createPhoto));
        setSelectedImageId(null);
      } else {
        setFormData({ ...initialFormData, year: new Date().getFullYear() });
        setPhotos([]);
        setSelectedImageId(null);
      }
    }
  }, [open, vehicle]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      errorRef.current.focus();
    }
  }, [error]);

  useEffect(() => {
    const clearPhotoSelectionOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-vehicle-photo]')) return;
      setSelectedImageId(null);
    };
    document.addEventListener('pointerdown', clearPhotoSelectionOutside);
    return () => document.removeEventListener('pointerdown', clearPhotoSelectionOutside);
  }, []);

  const formatPlate = (value: string): string => {
    let cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 7) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
    }
  };

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPlate(e.target.value);
    setFormData({ ...formData, plate: formatted });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = Array.from(input.files || []);
    if (files.length === 0) return;
    input.value = '';
    if (!profile?.company_id) {
      toast.error('Sua conta não está vinculada a uma concessionária.');
      return;
    }

    const pending = files.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }));
    setPendingImageUploads((current) => current + pending.length);
    setPhotos((current) => [...current, ...pending.map(({ id, previewUrl }) => ({ id, url: previewUrl, uploading: true, newUpload: false }))]);

    await Promise.all(pending.map(async ({ id, file, previewUrl }) => {
      try {
        const url = await uploadVehicleImage(file, { companyId: profile.company_id!, kind: 'vehicles' });
        if (cancelledImageUploads.current.delete(id)) {
          await deleteVehicleImage(url);
          return;
        }
        setPhotos((current) => current.map((photo) => photo.id === id ? { ...photo, url, uploading: false, newUpload: true } : photo));
      } catch (uploadError) {
        if (!cancelledImageUploads.current.has(id)) {
          const detail = uploadError instanceof Error ? uploadError.message : 'Falha ao enviar a foto.';
          toast.error(`${file.name}: ${detail}`);
          setPhotos((current) => current.filter((photo) => photo.id !== id));
        }
      } finally {
        URL.revokeObjectURL(previewUrl);
        setPendingImageUploads((current) => Math.max(0, current - 1));
      }
    }));
  };

  const removeImage = (photoId: string) => {
    const photo = photos.find((current) => current.id === photoId);
    if (!photo) return;
    if (photo.uploading) {
      cancelledImageUploads.current.add(photoId);
      URL.revokeObjectURL(photo.url);
    } else if (photo.newUpload) {
      void deleteVehicleImage(photo.url).catch((deleteError) => {
        toast.error(deleteError instanceof Error ? deleteError.message : 'Não foi possível remover a foto do Storage.');
      });
    } else if (!photo.url.startsWith('data:')) {
      // Defer deletion of existing files until the database update succeeds.
      imagesToDeleteAfterSave.current.add(photo.url);
    }
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
    setSelectedImageId((current) => current === photoId ? null : current);
  };

  const discardUnsavedPhotos = () => {
    const uploadsToDiscard = photos.filter((photo) => photo.newUpload).map((photo) => photo.url);
    imagesToDeleteAfterSave.current.clear();
    setPhotos((current) => current.filter((photo) => !photo.newUpload));
    onClose();
    void Promise.all(uploadsToDiscard.map((url) => deleteVehicleImage(url).catch((deleteError) => {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Não foi possível remover uma foto não salva.');
    })));
  };

  const deleteRemovedPhotos = async () => {
    const removed = Array.from(imagesToDeleteAfterSave.current);
    imagesToDeleteAfterSave.current.clear();
    await Promise.all(removed.map((url) => deleteVehicleImage(url).catch((deleteError) => {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Não foi possível remover uma foto antiga do Storage.');
    })));
  };

  const moveImageTo = (targetId: string) => {
    if (!draggedImageId || draggedImageId === targetId) return;
    setPhotos((current) => {
      const next = [...current];
      const fromIndex = next.findIndex((photo) => photo.id === draggedImageId);
      const targetIndex = next.findIndex((photo) => photo.id === targetId);
      if (fromIndex < 0 || targetIndex < 0) return current;
      const [movedImage] = next.splice(fromIndex, 1);
      next.splice(targetIndex, 0, movedImage);
      return next;
    });
    setSelectedImageId(draggedImageId);
  };

  const handleFipeValue = (vehicleData: FipeVehicle, value: number) => {
    setFormData((current) => ({
      ...current,
      brand: vehicleData.Marca || current.brand,
      model: vehicleData.Modelo || current.model,
      year: vehicleData.AnoModelo || current.year,
      sale_price: formatBRLInput(value),
      fipe_code: vehicleData.CodigoFipe || current.fipe_code,
      fuel_type: normalizeFuel(vehicleData.Combustivel || vehicleData.SiglaCombustivel || '') || current.fuel_type,
      transmission: inferTransmission(vehicleData.Modelo || '') || current.transmission,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const purchasePrice = parseBRLInput(formData.purchase_price);
      const salePrice = parseBRLInput(formData.sale_price);
      if (!Number.isFinite(purchasePrice) || !Number.isFinite(salePrice) || purchasePrice < 0 || salePrice < 0) throw new Error('Informe valores válidos para compra e venda.');
      const vehicleData = {
        company_id: profile?.company_id || null,
        brand: formData.brand,
        model: formData.model,
        year: formData.year,
        version: formData.version || null,
        purchase_price: purchasePrice,
        sale_price: salePrice,
        images: photos.map((photo) => photo.url),
        fipe_code: formData.fipe_code || null,
        status: formData.status,
        color: formData.color || null,
        plate: formData.plate || null,
        mileage: formData.mileage ? parseInt(parseMileage(formData.mileage), 10) : null,
        fuel_type: formData.fuel_type || null,
        transmission: formData.transmission || null,
        description: formData.description || null,
        created_by: user?.id,
      };

      if (vehicle) {
        const { error } = await supabase
          .from("vehicles")
          .update(vehicleData)
          .eq("id", vehicle.id)
          .eq("company_id", profile!.company_id!)
          .select('id')
          .single();
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vehicles")
          .insert([vehicleData])
          .select('id')
          .single();
        if (error) throw error;
      }

      await deleteRemovedPhotos();
      setPhotos((current) => current.map((photo) => ({ ...photo, newUpload: false })));
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar veículo");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !loading && pendingImageUploads === 0) discardUnsavedPhotos(); }}>
      <DialogContent
        className="sm:max-w-6xl max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={(e) => { if (loading || pendingImageUploads > 0) e.preventDefault(); }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="pr-6">
          <DialogTitle className="text-2xl font-bold text-foreground">
            {vehicle ? "Editar Veículo" : "Cadastrar Novo Veículo"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {vehicle ? "Edite as informações do veículo." : "Preencha as informações para cadastrar um novo veículo."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3 outline-none"
          >
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <FipeSearch onValueFound={handleFipeValue} />

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="brand">Marca *</Label>
              <select id="brand" name="brand" value={formData.brand} onChange={handleChange} required className={selectClass}>
                <option value="">Selecione a marca...</option>
                {formData.brand && !CAR_BRANDS.some((brand) => brand.toLocaleLowerCase('pt-BR') === formData.brand.toLocaleLowerCase('pt-BR')) && <option value={formData.brand}>{formData.brand}</option>}
                {CAR_BRANDS.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo *</Label>
              <Input id="model" name="model" value={formData.model} onChange={handleChange} required placeholder="Corolla, Civic, Fiesta..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Ano *</Label>
              <Input type="number" id="year" name="year" value={formData.year} onChange={handleChange} required min="1900" max={new Date().getFullYear() + 1} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">Versão</Label>
              <Input id="version" name="version" value={formData.version} onChange={handleChange} placeholder="XEi, EXL, SE..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_price">Valor de Compra (R$) *</Label>
              <Input type="text" inputMode="decimal" id="purchase_price" name="purchase_price" value={formData.purchase_price} onChange={handleChange} onBlur={() => { const value = parseBRLInput(formData.purchase_price); if (Number.isFinite(value)) setFormData((current) => ({ ...current, purchase_price: formatBRLInput(value) })); }} required placeholder="200.000,00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale_price">Valor de Venda (R$) *</Label>
              <Input type="text" inputMode="decimal" id="sale_price" name="sale_price" value={formData.sale_price} onChange={handleChange} onBlur={() => { const value = parseBRLInput(formData.sale_price); if (Number.isFinite(value)) setFormData((current) => ({ ...current, sale_price: formatBRLInput(value) })); }} required placeholder="200.000,00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <select id="status" name="status" value={formData.status} onChange={handleChange} className={selectClass}>
                <option value="disponivel">Disponível</option>
                <option value="em_negociacao">Em Negociação</option>
                <option value="vendido">Vendido</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Input id="color" name="color" value={formData.color} onChange={handleChange} placeholder="Preto, Branco, Prata..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plate">Placa</Label>
              <Input id="plate" name="plate" value={formData.plate} onChange={handlePlateChange} maxLength={8} className="uppercase" placeholder="ABC-1D23" />
              <p className="text-xs text-muted-foreground">Formato: ABC-1234 ou ABC-1D23 (Mercosul)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mileage">Quilometragem (km)</Label>
              <Input type="text" inputMode="numeric" id="mileage" name="mileage" value={formData.mileage} onChange={(event) => setFormData((current) => ({ ...current, mileage: event.target.value.replace(/[^\d.]/g, '') }))} onBlur={() => { const digits = parseMileage(formData.mileage); if (digits) setFormData((current) => ({ ...current, mileage: formatMileage(Number(digits)) })); }} placeholder="50.000" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fuel_type">Combustível</Label>
              <select id="fuel_type" name="fuel_type" value={formData.fuel_type} onChange={handleChange} className={selectClass}>
                <option value="">Selecione...</option>
                <option value="gasolina">Gasolina</option>
                <option value="etanol">Etanol</option>
                <option value="flex">Flex</option>
                <option value="diesel">Diesel</option>
                <option value="eletrico">Elétrico</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transmission">Transmissão</Label>
              <select id="transmission" name="transmission" value={formData.transmission} onChange={handleChange} className={selectClass}>
                <option value="">Selecione...</option>
                <option value="manual">Manual</option>
                <option value="automatica">Automática</option>
                <option value="automatizada">Automatizada</option>
                <option value="cvt">CVT</option>
              </select>
            </div>
          </div>

          <div className="border border-border rounded-2xl bg-muted p-5">
              <p className="text-sm font-semibold text-foreground mb-1">Fotos do Veículo</p>
              <p className="mb-3 text-xs text-muted-foreground">Arraste as fotos para ordenar. A foto 1 será a capa exibida primeiro na vitrine.</p>

            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-card hover:border-primary transition-colors">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <input type="file" id="image-upload" accept="image/*" multiple disabled={loading} onChange={handleImageUpload} className="hidden" />
              <label
                htmlFor="image-upload"
                className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                Selecionar Fotos
              </label>
              <p className="text-sm text-muted-foreground mt-3">PNG, JPG ou WEBP (máx. 15 MB cada). As fotos são otimizadas ao enviar.</p>
            </div>

            {photos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    layout="position"
                    transition={{ layout: { type: 'spring', stiffness: 480, damping: 38 } }}
                    draggable
                    onClick={() => setSelectedImageId(photo.id)}
                    onDragStartCapture={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedImageId(photo.id); setSelectedImageId(photo.id); }}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                    onDragEnter={() => moveImageTo(photo.id)}
                    onDrop={(event) => { event.preventDefault(); moveImageTo(photo.id); }}
                    onDragEnd={() => setDraggedImageId(null)}
                    className={`group relative cursor-grab overflow-hidden rounded-lg border-2 transition-shadow hover:shadow-lg hover:shadow-primary/25 active:cursor-grabbing ${selectedImageId === photo.id ? 'border-primary/55 shadow-md' : 'border-border'} ${draggedImageId === photo.id ? 'z-10 opacity-75' : ''}`}
                    style={{ boxShadow: selectedImageId === photo.id ? '0 0 0 1px color-mix(in srgb, var(--primary) 28%, transparent), 0 8px 22px -12px color-mix(in srgb, var(--primary) 48%, transparent)' : undefined }}
                    data-vehicle-photo
                    aria-label={`Foto ${index + 1}. Arraste para alterar a ordem.`}
                  >
                    <img src={thumbUrl(photo.url)} alt={`Foto ${index + 1}`} className="h-32 w-full object-cover" draggable={false} />
                    <div className={`absolute inset-0 transition-colors ${selectedImageId === photo.id ? 'bg-black/45' : 'bg-transparent group-hover:bg-black/25'}`} />
                    {photo.uploading && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/65 text-xs font-medium text-white"><LoaderCircle className="size-6 animate-spin" aria-hidden="true" />Enviando foto…</div>}
                    <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full border-2 border-primary/65 bg-primary/90 text-sm font-bold text-primary-foreground shadow" aria-label={`Posição ${index + 1}`}>
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); removeImage(photo.id); }}
                      className="absolute left-2 top-2 rounded-full border border-white/70 bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Excluir foto ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Informações adicionais sobre o veículo..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" className="flex-1" onClick={discardUnsavedPhotos} disabled={loading || pendingImageUploads > 0}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || pendingImageUploads > 0} className="flex-1">
              {loading ? "Salvando..." : pendingImageUploads > 0 ? "Enviando fotos..." : vehicle ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

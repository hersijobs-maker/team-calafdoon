import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  Plus, Trash2, Pencil, Loader2, X, Upload, Eye, EyeOff,
  GripVertical, ExternalLink, Megaphone,
} from 'lucide-react';
import type { Advertisement, AdMediaType } from '@/lib/types';

interface AdFormData {
  title: string;
  description: string;
  media_url: string;
  media_type: AdMediaType;
  button_text: string;
  button_link: string;
  is_active: boolean;
  sort_order: string;
}

const emptyForm: AdFormData = {
  title: '',
  description: '',
  media_url: '',
  media_type: 'image',
  button_text: '',
  button_link: '',
  is_active: true,
  sort_order: '0',
};

export function AdminAdvertisements() {
  const { show } = useToast();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAd, setEditAd] = useState<Advertisement | null>(null);
  const [form, setForm] = useState<AdFormData>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Advertisement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAds = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('advertisements')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    setAds((data as Advertisement[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditAd(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (ad: Advertisement) => {
    setEditAd(ad);
    setForm({
      title: ad.title,
      description: ad.description || '',
      media_url: ad.media_url,
      media_type: ad.media_type,
      button_text: ad.button_text || '',
      button_link: ad.button_link || '',
      is_active: ad.is_active,
      sort_order: ad.sort_order.toString(),
    });
    setShowModal(true);
  };

  const detectMediaType = (file: File): AdMediaType => {
    if (file.type === 'image/gif') return 'gif';
    if (file.type.startsWith('video/')) return 'video';
    return 'image';
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      show('Faylka waa inuu noqdaa in ka yar 50MB', 'error');
      return;
    }
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
    ];
    if (!allowed.includes(file.type)) {
      show('Nooca faylka laguma taageerno. JPG, PNG, WEBP, GIF, ama MP4', 'error');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `ad-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('advertisements')
        .upload(fileName, file);

      if (uploadError) {
        show('Lama soo geli karo faylka', 'error');
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('advertisements')
        .getPublicUrl(fileName);

      setForm((prev) => ({
        ...prev,
        media_url: urlData.publicUrl,
        media_type: detectMediaType(file),
      }));
      show('Faylka waa la soo geliyay', 'success');
    } catch {
      show('Khalad ayaa dhacay', 'error');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      show('Cinwaanka waa loo baahan yahay', 'error');
      return;
    }
    if (!form.media_url) {
      show('Fadlan soo geli sawir ama video', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        media_url: form.media_url,
        media_type: form.media_type,
        button_text: form.button_text.trim() || null,
        button_link: form.button_link.trim() || null,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order, 10) || 0,
      };

      if (editAd) {
        const { error } = await supabase
          .from('advertisements')
          .update(payload)
          .eq('id', editAd.id);
        if (error) throw error;
        show('Ad waa la cusbooneysiiyay', 'success');
      } else {
        const { error } = await supabase
          .from('advertisements')
          .insert(payload);
        if (error) throw error;
        show('Ad waa la abuuray', 'success');
      }

      setShowModal(false);
      resetForm();
      await loadAds();
    } catch (err) {
      show((err as Error).message || 'Khalad ayaa dhacay', 'error');
    }
    setSaving(false);
  };

  const handleToggleActive = async (ad: Advertisement) => {
    const { error } = await supabase
      .from('advertisements')
      .update({ is_active: !ad.is_active })
      .eq('id', ad.id);
    if (error) {
      show('Lama beddelin xaalada', 'error');
    } else {
      show(ad.is_active ? 'Ad waa la damiyay' : 'Ad waa la firiyay', 'success');
      await loadAds();
    }
  };

  const handleDelete = async (ad: Advertisement) => {
    try {
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', ad.id);
      if (error) throw error;
      show('Ad waa la tirtiray', 'success');
      setDeleteConfirm(null);
      await loadAds();
    } catch (err) {
      show((err as Error).message || 'Lama tirtirin ad-ka', 'error');
    }
  };

  const set = (field: keyof AdFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">Xayaysiisyada</h2>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Ku Dar Ad</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Wali xayaysiisyo ma jiraan</p>
          <p className="text-xs text-slate-400 mt-1">Ku dar xayaysiis cusub si aad u muujin bogga hore.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad) => (
            <div key={ad.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Media preview */}
              <div className="relative h-40 bg-slate-100 overflow-hidden">
                {ad.media_type === 'video' ? (
                  <video src={ad.media_url} muted className="w-full h-full object-cover" />
                ) : (
                  <img src={ad.media_url} alt={ad.title} className="w-full h-full object-cover" draggable={false} onContextMenu={(e) => e.preventDefault()} />
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    ad.is_active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {ad.is_active ? 'Firin' : 'Dami'}
                  </span>
                </div>
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-black/50 text-white backdrop-blur-sm">
                    {ad.media_type.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 text-sm truncate">{ad.title}</h3>
                {ad.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ad.description}</p>
                )}
                {ad.button_text && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600">
                    <ExternalLink className="w-3 h-3" />
                    <span className="truncate">{ad.button_text}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                  <GripVertical className="w-3 h-3" />
                  Tartiib: {ad.sort_order}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                  <button onClick={() => openEdit(ad)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title="Wax ka beddel">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleActive(ad)} className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors" title={ad.is_active ? 'Dami' : 'Firi'}>
                    {ad.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setDeleteConfirm(ad)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors" title="Tirtiri">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">{editAd ? 'Wax Ka Beddel Ad' : 'Ku Dar Ad Cusub'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Media upload */}
              <div>
                <label className={labelClass}>Sawir / Video / GIF *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-400 transition-colors"
                >
                  {form.media_url ? (
                    <div className="relative">
                      {form.media_type === 'video' ? (
                        <video src={form.media_url} muted className="max-h-40 mx-auto rounded-lg" />
                      ) : (
                        <img src={form.media_url} alt="Preview" className="max-h-40 mx-auto rounded-lg" draggable={false} />
                      )}
                      <p className="text-xs text-slate-500 mt-2">Guji si aad u beddesho</p>
                    </div>
                  ) : uploading ? (
                    <div className="flex flex-col items-center gap-2 py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                      <p className="text-xs text-slate-500">Soo gelinaya...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-6">
                      <Upload className="w-8 h-8 text-slate-400" />
                      <p className="text-xs text-slate-500">Guji si aad u doorato faylka</p>
                      <p className="text-[10px] text-slate-400">JPG, PNG, WEBP, GIF, MP4 (MAX 50MB)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                  }}
                />
              </div>

              <div>
                <label className={labelClass}>Cinwaanka *</label>
                <input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Cinwaanka xayaysiiska" />
              </div>

              <div>
                <label className={labelClass}>Fahfahin</label>
                <textarea className={`${inputClass} min-h-[70px] resize-y`} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Fahfahinta xayaysiiska" />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Qoraalka Batoonka</label>
                  <input className={inputClass} value={form.button_text} onChange={(e) => set('button_text', e.target.value)} placeholder="T.d. Soo Gal" />
                </div>
                <div>
                  <label className={labelClass}>Link-ka Batoonka</label>
                  <input className={inputClass} value={form.button_link} onChange={(e) => set('button_link', e.target.value)} placeholder="https://..." />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Tartiib (sort_order)</label>
                  <input type="number" className={inputClass} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => set('is_active', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">Firin bogga hore</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editAd ? 'Kaydi Beddelka' : 'Abuur Ad'}
              </button>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
                Jooji
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Tirtiri Ad</h2>
            <p className="text-sm text-slate-600 mb-6">
              Ma hubtaa inaad tirtirayso <span className="font-semibold">{deleteConfirm.title}</span>? Hawshan lama soceli karo.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg hover:bg-red-700 transition-colors">
                Tirtiri
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
                Jooji
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

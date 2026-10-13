import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
} from '@heroui/react';
import {
  Tag,
  ShoppingBag,
  Utensils,
  Car,
  Home,
  Zap,
  Heart,
  Film,
  Smartphone,
  Coffee,
  Briefcase,
  Gift,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Layers,
} from 'lucide-react';
import { Category, CategoryType } from '../types/api';
import { apiClient } from '../services/apiClient';

export interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  categories: Category[];
}

export const COLOR_SWATCHES = [
  { label: 'Slate', value: '#64748b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Rose', value: '#f43f5e' },
];

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  tag: Tag,
  'shopping-bag': ShoppingBag,
  utensils: Utensils,
  car: Car,
  home: Home,
  zap: Zap,
  heart: Heart,
  film: Film,
  smartphone: Smartphone,
  coffee: Coffee,
  briefcase: Briefcase,
  gift: Gift,
};

export const AVAILABLE_ICONS = [
  { key: 'tag', label: 'Tag', icon: Tag },
  { key: 'shopping-bag', label: 'Belanja', icon: ShoppingBag },
  { key: 'utensils', label: 'Kuliner', icon: Utensils },
  { key: 'car', label: 'Kendaraan', icon: Car },
  { key: 'home', label: 'Rumah', icon: Home },
  { key: 'zap', label: 'Tagihan', icon: Zap },
  { key: 'heart', label: 'Kesehatan', icon: Heart },
  { key: 'film', label: 'Hiburan', icon: Film },
  { key: 'smartphone', label: 'Komunikasi', icon: Smartphone },
  { key: 'coffee', label: 'Kopi', icon: Coffee },
  { key: 'briefcase', label: 'Pekerjaan', icon: Briefcase },
  { key: 'gift', label: 'Hadiah', icon: Gift },
];

export function getCategoryIcon(iconKey?: string): React.ComponentType<{ className?: string }> {
  if (!iconKey) return Tag;
  const normalized = iconKey.toLowerCase().trim();
  return ICON_MAP[normalized] || Tag;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
}) => {
  const [activeTab, setActiveTab] = useState<CategoryType>('EXPENSE');
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [name, setName] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('#10b981');
  const [selectedIcon, setSelectedIcon] = useState<string>('tag');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync prop changes
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  // Reset form on open/close
  useEffect(() => {
    if (isOpen) {
      resetForm();
      setErrorMsg(null);
      setSuccessMsg(null);
      setDeletingId(null);
    }
  }, [isOpen]);

  const dialogRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    node.setAttribute('aria-labelledby', 'category-manager-modal-title');
    const observer = new MutationObserver(() => {
      if (node.getAttribute('aria-labelledby') !== 'category-manager-modal-title') {
        node.setAttribute('aria-labelledby', 'category-manager-modal-title');
      }
    });
    observer.observe(node, { attributes: true, attributeFilter: ['aria-labelledby'] });
  }, []);

  const resetForm = () => {
    setName('');
    setSelectedColor('#10b981');
    setSelectedIcon('tag');
    setEditingCategory(null);
    setErrorMsg(null);
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSelectedColor(cat.color || '#10b981');
    setSelectedIcon(cat.icon || 'tag');
    setErrorMsg(null);
    setSuccessMsg(null);
    setDeletingId(null);
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg('Nama kategori wajib diisi.');
      return;
    }
    if (trimmed.length > 50) {
      setErrorMsg('Nama kategori maksimal 50 karakter.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingCategory) {
        // Update existing category
        const updated = await apiClient.updateCategory(editingCategory.id, {
          name: trimmed,
          category_type: (editingCategory.category_type as CategoryType) || activeTab,
          icon: selectedIcon,
          color: selectedColor,
        });

        setLocalCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        setSuccessMsg(`Kategori "${trimmed}" berhasil diperbarui.`);
        resetForm();
        await onSuccess();
      } else {
        // Create new category
        const created = await apiClient.createCategory({
          name: trimmed,
          category_type: activeTab,
          icon: selectedIcon,
          color: selectedColor,
        });

        setLocalCategories((prev) => [...prev, created]);
        setSuccessMsg(`Kategori "${trimmed}" berhasil ditambahkan.`);
        resetForm();
        await onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan kategori.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.deleteCategory(id);
      setLocalCategories((prev) => prev.filter((c) => c.id !== id));
      setDeletingId(null);
      setSuccessMsg('Kategori berhasil dihapus.');
      await onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menghapus kategori.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredCategories = localCategories.filter((c) => {
    const catType = (c.category_type || 'EXPENSE').toUpperCase();
    return catType === activeTab;
  });

  return (
    <Modal
      ref={dialogRef}
      isOpen={isOpen}
      onClose={onClose}
      backdrop="blur"
      disableAnimation
      classNames={{
        base: 'bg-white dark:bg-[#042421] border-2 border-[#10B981]/30 text-slate-900 dark:text-white max-w-xl max-h-[90vh] overflow-y-auto rounded-[28px] shadow-2xl shadow-[#10B981]/10 text-left select-none',
        backdrop: 'bg-black/60 backdrop-blur-md',
        closeButton: 'hover:bg-slate-100 dark:hover:bg-[#021D17] text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl',
      }}
    >
      <ModalContent>
        {() => (
          <div>
            <ModalHeader>
              <div className="flex items-center justify-between w-full pr-6">
                <div>
                  <h3 id="category-manager-modal-title" className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                    Kelola Kategori
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-emerald-200/80 font-medium mt-0.5">
                    Sesuaikan pos anggaran, ikon representatif, dan aksen warna
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 shadow-xs">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="pb-6 space-y-5">
              {/* Notifications: Error & Success */}
              {errorMsg && (
                <div className="p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 bg-emerald-500/15 border border-[#10B981]/30 text-[#0F766E] dark:text-[#10B981]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Category Type Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-[#021D17] p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 text-xs">
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setActiveTab('EXPENSE');
                    if (!editingCategory) resetForm();
                  }}
                  className={`py-2 px-3 rounded-xl font-extrabold transition-all flex items-center justify-center gap-2 min-h-[38px] ${
                    activeTab === 'EXPENSE'
                      ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-[#10B981]/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-[#10B981] bg-transparent'
                  }`}
                >
                  Pengeluaran
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setActiveTab('INCOME');
                    if (!editingCategory) resetForm();
                  }}
                  className={`py-2 px-3 rounded-xl font-extrabold transition-all flex items-center justify-center gap-2 min-h-[38px] ${
                    activeTab === 'INCOME'
                      ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-[#10B981]/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-[#10B981] bg-transparent'
                  }`}
                >
                  Pemasukan
                </Button>
              </div>

              {/* Form Section */}
              <form
                onSubmit={handleSubmit}
                className="bg-slate-50 dark:bg-[#021D17]/60 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {editingCategory ? 'Ubah Kategori' : 'Tambah Kategori Baru'}
                  </h4>
                  {editingCategory && (
                    <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                      Mode Edit
                    </span>
                  )}
                </div>

                {/* Name Input */}
                <div>
                  <label htmlFor="category-name-input" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                    Nama Kategori
                  </label>
                  <input
                    id="category-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Makanan, Transportasi, Hiburan..."
                    maxLength={50}
                    disabled={isSubmitting}
                    className="w-full bg-white dark:bg-[#021D17]/80 border border-slate-200 dark:border-[#10B981]/30 focus:border-[#10B981] rounded-2xl px-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all font-medium disabled:opacity-50 min-h-[38px]"
                  />
                  <div className="text-right text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                    {name.length}/50 karakter
                  </div>
                </div>

                {/* Color Swatch Picker */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-2">
                    Warna Aksen
                  </label>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pilihan Warna">
                    {COLOR_SWATCHES.map((swatch) => {
                      const isSelected = selectedColor.toLowerCase() === swatch.value.toLowerCase();
                      return (
                        <Button
                          key={swatch.value}
                          isIconOnly
                          aria-label={`Warna ${swatch.label}`}
                          aria-checked={isSelected}
                          role="radio"
                          isDisabled={isSubmitting}
                          onPress={() => setSelectedColor(swatch.value)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 min-h-[38px] min-w-[38px] p-0 focus:outline-none ${
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#042421] ring-[#10B981] scale-105'
                              : 'opacity-85 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: swatch.value }}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Icon Grid Picker */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-2">
                    Pilihan Ikon
                  </label>
                  <div
                    role="radiogroup"
                    aria-label="Pilihan Ikon"
                    className="grid grid-cols-4 sm:grid-cols-6 gap-2"
                  >
                    {AVAILABLE_ICONS.map((item) => {
                      const IconComp = item.icon;
                      const isSelected = selectedIcon.toLowerCase() === item.key.toLowerCase();
                      return (
                        <Button
                          key={item.key}
                          role="radio"
                          aria-checked={isSelected}
                          aria-label={`Ikon ${item.label}`}
                          isDisabled={isSubmitting}
                          onPress={() => setSelectedIcon(item.key)}
                          className={`p-2 rounded-2xl flex flex-col items-center justify-center gap-1 min-h-[46px] min-w-[38px] h-auto transition-all border text-xs font-bold ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] border-[#10B981] text-white shadow-md'
                              : 'bg-white dark:bg-[#021D17] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-[#10B981]'
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                          <span className="text-[10px] truncate max-w-full font-medium">{item.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80 dark:border-white/10">
                  {editingCategory && (
                    <Button
                      variant="light"
                      isDisabled={isSubmitting}
                      onPress={handleCancelEdit}
                      className="min-h-[38px] text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Batal Edit
                    </Button>
                  )}
                  <Button
                    type="submit"
                    isDisabled={isSubmitting}
                    className="bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-[#10B981]/25 px-5 min-h-[38px]"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </div>
                    ) : editingCategory ? (
                      'Perbarui Kategori'
                    ) : (
                      'Tambah Kategori'
                    )}
                  </Button>
                </div>
              </form>

              {/* Categories List Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Daftar Kategori {activeTab === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan'} ({filteredCategories.length})
                  </h4>
                </div>

                {filteredCategories.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#021D17]/40 border border-slate-200 dark:border-white/10 text-center">
                    <p className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                      Belum ada kategori {activeTab === 'EXPENSE' ? 'pengeluaran' : 'pemasukan'}.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                      Buat kategori baru menggunakan formulir di atas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCategories.map((cat) => {
                      const IconComp = getCategoryIcon(cat.icon);
                      const isConfirmingDelete = deletingId === cat.id;

                      return (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 dark:bg-[#021D17]/60 border border-slate-200/80 dark:border-white/10 hover:border-[#10B981]/40 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs"
                              style={{
                                backgroundColor: `${cat.color || '#10b981'}20`,
                                borderColor: `${cat.color || '#10b981'}40`,
                                color: cat.color || '#10b981',
                              }}
                            >
                              <IconComp className="w-4 h-4" />
                            </div>
                            <span
                              data-testid="category-item-name"
                              className="font-extrabold text-sm text-slate-900 dark:text-white"
                            >
                              {cat.name}
                            </span>
                          </div>

                          {/* Action Buttons / Confirm State */}
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-rose-500 dark:text-rose-400 font-bold hidden sm:inline">
                                Yakin hapus kategori ini?
                              </span>
                              <Button
                                size="sm"
                                color="danger"
                                variant="flat"
                                isDisabled={isSubmitting}
                                onPress={() => handleDelete(cat.id)}
                                className="min-h-[38px] px-3.5 text-xs font-extrabold text-rose-600 dark:text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 rounded-xl"
                              >
                                {isSubmitting ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  'Ya, Hapus'
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="light"
                                isDisabled={isSubmitting}
                                onPress={() => setDeletingId(null)}
                                className="min-h-[38px] px-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl"
                              >
                                Batal
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                aria-label={`Edit ${cat.name}`}
                                onPress={() => handleStartEdit(cat)}
                                className="min-h-[36px] min-w-[36px] p-2 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-[#10B981] hover:bg-[#10B981]/10 transition-colors bg-transparent"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                aria-label={`Hapus ${cat.name}`}
                                onPress={() => {
                                  setDeletingId(cat.id);
                                  setErrorMsg(null);
                                  setSuccessMsg(null);
                                }}
                                className="min-h-[36px] min-w-[36px] p-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors bg-transparent"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ModalBody>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};
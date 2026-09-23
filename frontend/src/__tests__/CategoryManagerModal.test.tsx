import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
import { Category } from '../types/api';
import { apiClient } from '../services/apiClient';

describe('CategoryManagerModal Component', () => {
  const sampleCategories: Category[] = [
    {
      id: 'cat-1',
      name: 'Makanan & Minuman',
      category_type: 'EXPENSE',
      icon: 'utensils',
      color: '#ef4444',
    },
    {
      id: 'cat-2',
      name: 'Transportasi',
      category_type: 'EXPENSE',
      icon: 'car',
      color: '#3b82f6',
    },
    {
      id: 'cat-3',
      name: 'Gaji Bulanan',
      category_type: 'INCOME',
      icon: 'briefcase',
      color: '#10b981',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CategoryManagerModal
        isOpen={false}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        categories={sampleCategories}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal header, tabs, form controls, and lists categories for active tab (EXPENSE)', () => {
    render(
      <CategoryManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        categories={sampleCategories}
      />
    );

    expect(screen.getByText(/Kelola Kategori/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pengeluaran/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pemasukan/i })).toBeInTheDocument();

    // Active tab is Pengeluaran by default: EXPENSE categories visible, INCOME not visible
    expect(screen.getByText('Makanan & Minuman')).toBeInTheDocument();
    expect(screen.getByText('Transportasi')).toBeInTheDocument();
    expect(screen.queryByText('Gaji Bulanan')).not.toBeInTheDocument();

    // Form inputs present
    expect(screen.getByLabelText(/Nama Kategori/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tambah Kategori/i })).toBeInTheDocument();
  });

  it('filters categories according to active tab when switching between Pengeluaran and Pemasukan', () => {
    render(
      <CategoryManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        categories={sampleCategories}
      />
    );

    expect(screen.getByText('Makanan & Minuman')).toBeInTheDocument();
    expect(screen.queryByText('Gaji Bulanan')).not.toBeInTheDocument();

    // Switch to Pemasukan tab
    const incomeTab = screen.getByRole('button', { name: /Pemasukan/i });
    fireEvent.click(incomeTab);

    // Gaji Bulanan visible, EXPENSE items hidden
    expect(screen.getByText('Gaji Bulanan')).toBeInTheDocument();
    expect(screen.queryByText('Makanan & Minuman')).not.toBeInTheDocument();
    expect(screen.queryByText('Transportasi')).not.toBeInTheDocument();
  });

  it('renders empty state message when no categories exist for the active tab', () => {
    render(
      <CategoryManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        categories={[]}
      />
    );

    expect(screen.getByText(/Belum ada kategori pengeluaran/i)).toBeInTheDocument();

    // Switch to income tab
    fireEvent.click(screen.getByRole('button', { name: /Pemasukan/i }));
    expect(screen.getByText(/Belum ada kategori pemasukan/i)).toBeInTheDocument();
  });

  it('validates that category name cannot be empty', async () => {
    render(
      <CategoryManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        categories={sampleCategories}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Tambah Kategori/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Nama kategori wajib diisi/i)).toBeInTheDocument();
  });

  it('creates a new category calling createCategory and invokes onSuccess', async () => {
    const handleSuccess = vi.fn();
    const newCategory: Category = {
      id: 'cat-new-1',
      name: 'Asuransi Medis',
      category_type: 'EXPENSE',
      icon: 'heart',
      color: '#f43f5e',
    };

    const createSpy = vi.spyOn(apiClient, 'createCategory').mockResolvedValue(newCategory);

    render(
      <CategoryManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
        categories={sampleCategories}
      />
    );

    // Type name
    const nameInput = screen.getByLabelText(/Nama Kategori/i);
    fireEvent.change(nameInput, { target: { value: 'Asuransi Medis' } });

    // Pick Rose color (#f43f5e)
    const roseColorBtn = screen.getByLabelText(/Warna Rose/i);
    fireEvent.click(roseColorBtn);

    // Pick Heart icon
    const heartIconBtn = screen.getByLabelText(/Ikon Kesehatan/i);
    fireEvent.click(heartIconBtn);

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Tambah Kategori/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        name: 'Asuransi Medis',
        category_type: 'EXPENSE',
        icon: 'heart',
        color: '#f43f5e',
      });
      expect(handleSuccess).toHaveBeenCalled();
    });

    // The newly created category appears in list and input is reset
    expect(await screen.findByText('Asuransi Medis')).toBeInTheDocument();
    expect(nameInput).toHaveValue('');
  });

  it('edits an existing category by pre-populating form and submitting updates', async () => {
    const handleSuccess = vi.fn();
    const updatedCategory: Category = {
      id: 'cat-1',
      name: 'Kuliner & Jajan',
      category_type: 'EXPENSE',
      icon: 'coffee',
      color: '#f59e0b',
    };

    const updateSpy = vi.spyOn(apiClient, 'updateCategory').mockResolvedValue(updatedCategory);

    render(
      <CategoryManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
        categories={sampleCategories}
      />
    );

    // Click edit button for "Makanan & Minuman"
    const editBtn = screen.getByLabelText(/Edit Makanan & Minuman/i);
    fireEvent.click(editBtn);

    // Input should be populated
    const nameInput = screen.getByLabelText(/Nama Kategori/i);
    expect(nameInput).toHaveValue('Makanan & Minuman');

    // Change name and icon
    fireEvent.change(nameInput, { target: { value: 'Kuliner & Jajan' } });
    fireEvent.click(screen.getByLabelText(/Ikon Kopi/i));
    fireEvent.click(screen.getByLabelText(/Warna Amber/i));

    // Button should now say "Perbarui Kategori"
    const updateSubmitBtn = screen.getByRole('button', { name: /Perbarui Kategori/i });
    fireEvent.click(updateSubmitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('cat-1', {
        name: 'Kuliner & Jajan',
        category_type: 'EXPENSE',
        icon: 'coffee',
        color: '#f59e0b',
      });
      expect(handleSuccess).toHaveBeenCalled();
    });

    // Updated name should be shown in list
    expect(await screen.findByText('Kuliner & Jajan')).toBeInTheDocument();
  });

  it('cancels edit mode and resets form when Batal button is clicked', () => {
    render(
      <CategoryManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        categories={sampleCategories}
      />
    );

    fireEvent.click(screen.getByLabelText(/Edit Makanan & Minuman/i));
    expect(screen.getByRole('button', { name: /Perbarui Kategori/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Batal Edit/i })).toBeInTheDocument();

    // Click Batal
    fireEvent.click(screen.getByRole('button', { name: /Batal Edit/i }));

    expect(screen.queryByRole('button', { name: /Perbarui Kategori/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tambah Kategori/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Kategori/i)).toHaveValue('');
  });

  it('triggers delete confirmation and deletes category via deleteCategory', async () => {
    const handleSuccess = vi.fn();
    const deleteSpy = vi.spyOn(apiClient, 'deleteCategory').mockResolvedValue({ detail: 'Category deleted.' });

    render(
      <CategoryManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
        categories={sampleCategories}
      />
    );

    expect(screen.getByText('Transportasi')).toBeInTheDocument();

    // Click delete button for Transportasi
    const deleteBtn = screen.getByLabelText(/Hapus Transportasi/i);
    fireEvent.click(deleteBtn);

    // Confirmation UI appears
    expect(screen.getByText(/Yakin hapus kategori ini\?/i)).toBeInTheDocument();
    const confirmDeleteBtn = screen.getByRole('button', { name: /Ya, Hapus/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('cat-2');
      expect(handleSuccess).toHaveBeenCalled();
    });

    // Category is removed from list
    expect(screen.queryByText('Transportasi')).not.toBeInTheDocument();
  });

  it('displays API error alert when category creation fails', async () => {
    vi.spyOn(apiClient, 'createCategory').mockRejectedValue(new Error('Kategori sudah ada.'));

    render(
      <CategoryManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        categories={sampleCategories}
      />
    );

    const nameInput = screen.getByLabelText(/Nama Kategori/i);
    fireEvent.change(nameInput, { target: { value: 'Duplikat' } });

    fireEvent.click(screen.getByRole('button', { name: /Tambah Kategori/i }));

    expect(await screen.findByText('Kategori sudah ada.')).toBeInTheDocument();
  });
});

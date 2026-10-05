export const REGISTRATION_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  BLOCKED: 'blocked',
} as const;

export const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Bilaash',
  pending_approval: 'Sugita',
  approved: 'Ansaxay',
  rejected: 'Diiday',
  blocked: 'Xannibay',
};

export const REGISTRATION_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  blocked: 'bg-gray-800 text-white border-gray-900',
};

export const GENDER_OPTIONS = [
  { value: 'male', label_so: 'Rag' },
  { value: 'female', label_so: 'Haween' },
];

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label_so: 'Aan guursan' },
  { value: 'divorced', label_so: 'Xaaskoodii kala qaadany' },
  { value: 'widowed', label_so: 'Lumay' },
  { value: 'married', label_so: 'Guursan' },
];

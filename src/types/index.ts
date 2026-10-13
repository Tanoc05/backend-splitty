import { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profile?: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: GroupMember[];
}

export interface ExpenseSplitInput {
  user_id: string;
  amount?: number;
  percentage?: number;
}

export interface Expense {
  id: string;
  group_id: string;
  paid_by: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  split_type: 'EQUAL' | 'EXACT' | 'PERCENTAGE';
  expense_date: string;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settlement {
  id: string;
  group_id: string;
  payer_id: string;
  receiver_id: string;
  amount: number;
  currency: string;
  settled_at: string;
  notes: string | null;
}

export interface MemberBalance {
  user_id: string;
  user_name: string;
  user_email: string;
  total_paid: number;
  total_owed: number;
  net_balance: number; // positive = must receive, negative = owes
}

export interface DebtTransfer {
  from_user_id: string;
  from_user_name: string;
  to_user_id: string;
  to_user_name: string;
  amount: number;
  currency: string;
}

export interface InfoItem {
  id: string;
  group_id: string | null;
  user_id: string;
  title: string;
  category: 'note' | 'iban' | 'link' | 'wifi' | 'todo' | 'custom';
  content: string;
  metadata: Record<string, any>;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

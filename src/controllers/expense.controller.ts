import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { supabase } from '../config/supabase.js';
import { BalanceService } from '../services/balance.service.js';

export const getExpenses = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = req.user?.id;

    // Check membership
    const { data: member } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!member) {
      res.status(403).json({
        success: false,
        message: 'Non sei autorizzato a visualizzare le spese di questo gruppo.',
      });
      return;
    }

    const { data: expenses, error } = await supabase
      .from('expenses')
      .select(`
        *,
        paid_by_profile:profiles!expenses_paid_by_fkey (id, email, full_name, avatar_url),
        expense_splits (
          id,
          user_id,
          amount,
          percentage,
          profiles (id, email, full_name, avatar_url)
        )
      `)
      .eq('group_id', groupId)
      .order('expense_date', { ascending: false });

    if (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recupero delle spese.',
        error: error.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: expenses,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore del server durante il recupero delle spese.',
      error: err.message,
    });
  }
};

export const createExpense = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const currentUserId = req.user?.id;
    const {
      group_id,
      paid_by,
      title,
      amount,
      currency,
      category,
      split_type,
      expense_date,
      receipt_url,
      notes,
      splits,
    } = req.body;

    const actualPayer = paid_by || currentUserId;

    // 1. Verify group membership
    const { data: members, error: membersErr } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id);

    if (membersErr || !members || members.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Gruppo non trovato o nessun membro presente.',
      });
      return;
    }

    const memberIds = members.map((m) => m.user_id);
    if (!memberIds.includes(currentUserId!)) {
      res.status(403).json({
        success: false,
        message: 'Non fai parte di questo gruppo.',
      });
      return;
    }

    // 2. Prepare Splits calculation
    let calculatedSplits: { user_id: string; amount: number; percentage?: number }[] = [];

    if (split_type === 'EQUAL') {
      // Split equally between provided users, or between ALL group members if none specified
      const targetUserIds =
        splits && splits.length > 0 ? splits.map((s: any) => s.user_id) : memberIds;

      const count = targetUserIds.length;
      if (count === 0) {
        res.status(400).json({ success: false, message: 'Nessun utente su cui dividere la spesa.' });
        return;
      }

      const rawShare = Math.floor((amount / count) * 100) / 100;
      let remainderCents = Math.round((amount - rawShare * count) * 100);

      calculatedSplits = targetUserIds.map((uid: string) => {
        let userAmount = rawShare;
        if (remainderCents > 0) {
          userAmount += 0.01;
          remainderCents -= 1;
        }
        return {
          user_id: uid,
          amount: Math.round(userAmount * 100) / 100,
          percentage: Math.round((100 / count) * 100) / 100,
        };
      });
    } else if (split_type === 'EXACT') {
      if (!splits || splits.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Per split_type EXACT è necessario specificare la lista dei singoli importi.',
        });
        return;
      }

      const totalSplit = splits.reduce((acc: number, s: any) => acc + (s.amount || 0), 0);
      if (Math.abs(totalSplit - amount) > 0.02) {
        res.status(400).json({
          success: false,
          message: `La somma delle quote individuali (${totalSplit.toFixed(2)}) non corrisponde al totale della spesa (${amount.toFixed(2)}).`,
        });
        return;
      }

      calculatedSplits = splits.map((s: any) => ({
        user_id: s.user_id,
        amount: Number(s.amount),
        percentage: Math.round(((s.amount || 0) / amount) * 10000) / 100,
      }));
    } else if (split_type === 'PERCENTAGE') {
      if (!splits || splits.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Per split_type PERCENTAGE è necessario specificare le percentuali per ciascun utente.',
        });
        return;
      }

      const totalPct = splits.reduce((acc: number, s: any) => acc + (s.percentage || 0), 0);
      if (Math.abs(totalPct - 100) > 0.1) {
        res.status(400).json({
          success: false,
          message: `La somma delle percentuali deve essere 100% (attuale: ${totalPct}%).`,
        });
        return;
      }

      calculatedSplits = splits.map((s: any) => ({
        user_id: s.user_id,
        amount: Math.round(((amount * (s.percentage || 0)) / 100) * 100) / 100,
        percentage: Number(s.percentage),
      }));
    }

    // 3. Create expense record
    const { data: expense, error: expErr } = await supabase
      .from('expenses')
      .insert({
        group_id,
        paid_by: actualPayer,
        title,
        amount,
        currency: currency || 'EUR',
        category: category || 'general',
        split_type,
        expense_date: expense_date || new Date().toISOString().split('T')[0],
        receipt_url: receipt_url || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (expErr || !expense) {
      res.status(500).json({
        success: false,
        message: 'Errore durante la creazione della spesa.',
        error: expErr?.message,
      });
      return;
    }

    // 4. Insert splits
    const splitsToInsert = calculatedSplits.map((cs) => ({
      expense_id: expense.id,
      user_id: cs.user_id,
      amount: cs.amount,
      percentage: cs.percentage,
    }));

    const { error: splitInsertErr } = await supabase
      .from('expense_splits')
      .insert(splitsToInsert);

    if (splitInsertErr) {
      res.status(500).json({
        success: false,
        message: 'Spesa creata ma errore nell\'inserimento della divisione delle quote.',
        error: splitInsertErr.message,
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Spesa creata e suddivisa con successo.',
      data: {
        ...expense,
        splits: splitsToInsert,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore interno durante il salvataggio della spesa.',
      error: err.message,
    });
  }
};

export const deleteExpense = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Check expense
    const { data: exp, error: findErr } = await supabase
      .from('expenses')
      .select('id, group_id, paid_by')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !exp) {
      res.status(404).json({ success: false, message: 'Spesa non trovata.' });
      return;
    }

    // Allow deletion if user paid it or is group admin
    const { data: member } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', exp.group_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (exp.paid_by !== userId && member?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Non sei autorizzato a cancellare questa spesa.',
      });
      return;
    }

    await supabase.from('expenses').delete().eq('id', id);

    res.status(200).json({
      success: true,
      message: 'Spesa eliminata con successo.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore durante l\'eliminazione della spesa.',
      error: err.message,
    });
  }
};

export const getGroupBalances = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = req.user?.id;

    // Check membership
    const { data: isMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!isMember) {
      res.status(403).json({
        success: false,
        message: 'Non sei autorizzato a consultare i saldi di questo gruppo.',
      });
      return;
    }

    // Fetch members with profiles
    const { data: members, error: memErr } = await supabase
      .from('group_members')
      .select(`
        user_id,
        profiles (
          full_name,
          email
        )
      `)
      .eq('group_id', groupId);

    if (memErr) {
      res.status(500).json({ success: false, message: memErr.message });
      return;
    }

    // Fetch all expenses with splits
    const { data: expenses, error: expErr } = await supabase
      .from('expenses')
      .select(`
        id,
        paid_by,
        amount,
        currency,
        expense_splits (
          user_id,
          amount
        )
      `)
      .eq('group_id', groupId);

    if (expErr) {
      res.status(500).json({ success: false, message: expErr.message });
      return;
    }

    // Fetch settlements
    const { data: settlements, error: setErr } = await supabase
      .from('settlements')
      .select('payer_id, receiver_id, amount')
      .eq('group_id', groupId);

    if (setErr) {
      res.status(500).json({ success: false, message: setErr.message });
      return;
    }

    const result = BalanceService.calculateBalances(
      (members as any) || [],
      (expenses as any) || [],
      (settlements as any) || []
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore nel calcolo dei saldi del gruppo.',
      error: err.message,
    });
  }
};

export const createSettlement = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const currentUserId = req.user?.id;
    const { group_id, payer_id, receiver_id, amount, currency, notes } = req.body;

    // Check membership
    const { data: isMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group_id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (!isMember) {
      res.status(403).json({
        success: false,
        message: 'Non fai parte di questo gruppo.',
      });
      return;
    }

    const { data: settlement, error } = await supabase
      .from('settlements')
      .insert({
        group_id,
        payer_id,
        receiver_id,
        amount,
        currency: currency || 'EUR',
        notes: notes || null,
      })
      .select(`
        *,
        payer:profiles!settlements_payer_id_fkey (id, email, full_name),
        receiver:profiles!settlements_receiver_id_fkey (id, email, full_name)
      `)
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nella registrazione del rimborso.',
        error: error.message,
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Rimborso registrato con successo.',
      data: settlement,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore del server durante la registrazione del rimborso.',
      error: err.message,
    });
  }
};

export const getSettlements = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = req.user?.id;

    const { data: isMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!isMember) {
      res.status(403).json({
        success: false,
        message: 'Non fai parte di questo gruppo.',
      });
      return;
    }

    const { data: settlements, error } = await supabase
      .from('settlements')
      .select(`
        *,
        payer:profiles!settlements_payer_id_fkey (id, email, full_name, avatar_url),
        receiver:profiles!settlements_receiver_id_fkey (id, email, full_name, avatar_url)
      `)
      .eq('group_id', groupId)
      .order('settled_at', { ascending: false });

    if (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recupero dei rimborsi.',
        error: error.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: settlements,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore durante il recupero dei rimborsi.',
      error: err.message,
    });
  }
};


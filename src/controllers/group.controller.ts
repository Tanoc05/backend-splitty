import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { supabase } from '../config/supabase.js';

export const getGroups = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    // Get group ids where user is a member
    const { data: memberships, error: memberErr } = await supabase
      .from('group_members')
      .select('group_id, role, joined_at')
      .eq('user_id', userId);

    if (memberErr) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recupero dei gruppi.',
        error: memberErr.message,
      });
      return;
    }

    const groupIds = (memberships || []).map((m) => m.group_id);

    if (groupIds.length === 0) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const { data: groups, error: groupErr } = await supabase
      .from('groups')
      .select(`
        *,
        group_members (
          id,
          user_id,
          role,
          joined_at,
          profiles (id, email, full_name, avatar_url)
        )
      `)
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    if (groupErr) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recupero dei dettagli dei gruppi.',
        error: groupErr.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: groups,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore del server durante il recupero dei gruppi.',
      error: err.message,
    });
  }
};

export const getGroupById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    // Check if user is a member
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      res.status(403).json({
        success: false,
        message: 'Non fai parte di questo gruppo o il gruppo non esiste.',
      });
      return;
    }

    const { data: group, error } = await supabase
      .from('groups')
      .select(`
        *,
        group_members (
          id,
          user_id,
          role,
          joined_at,
          profiles (id, email, full_name, avatar_url)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !group) {
      res.status(404).json({
        success: false,
        message: 'Gruppo non trovato.',
        error: error?.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: group,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore del server durante il recupero del gruppo.',
      error: err.message,
    });
  }
};

export const createGroup = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { name, description, currency } = req.body;

    // 1. Create Group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name,
        description,
        currency: currency || 'EUR',
        created_by: userId,
      })
      .select()
      .single();

    if (groupError || !group) {
      res.status(400).json({
        success: false,
        message: 'Impossibile creare il gruppo.',
        error: groupError?.message,
      });
      return;
    }

    // 2. Add creator as admin member
    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: userId,
      role: 'admin',
    });

    if (memberError) {
      res.status(500).json({
        success: false,
        message: 'Gruppo creato, ma errore nell\'aggiunta del creatore come membro.',
        error: memberError.message,
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Gruppo creato con successo.',
      data: group,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore durante la creazione del gruppo.',
      error: err.message,
    });
  }
};

export const addMember = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const currentUserId = req.user?.id;
    const { id: groupId } = req.params;
    const { email, role } = req.body;

    // Verify current user belongs to group
    const { data: isMember } = await supabase
      .from('group_members')
      .select('id, role')
      .eq('group_id', groupId)
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (!isMember) {
      res.status(403).json({
        success: false,
        message: 'Non sei autorizzato ad aggiungere membri a questo gruppo.',
      });
      return;
    }

    // Find target user by email in profiles
    const { data: targetProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (!targetProfile || profileErr) {
      res.status(404).json({
        success: false,
        message: `Nessun utente registrato trovato con l'email ${email}. L'utente deve prima registrarsi su Splitty.`,
      });
      return;
    }

    // Check if already in group
    const { data: alreadyMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', targetProfile.id)
      .maybeSingle();

    if (alreadyMember) {
      res.status(400).json({
        success: false,
        message: 'Questo utente fa già parte del gruppo.',
      });
      return;
    }

    // Add member
    const { data: newMember, error: addErr } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        user_id: targetProfile.id,
        role: role || 'member',
      })
      .select(`
        id,
        role,
        joined_at,
        profiles (id, email, full_name, avatar_url)
      `)
      .single();

    if (addErr) {
      res.status(500).json({
        success: false,
        message: 'Errore durante l\'aggiunta del membro.',
        error: addErr.message,
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Membro aggiunto al gruppo con successo.',
      data: newMember,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore del server durante l\'aggiunta del membro.',
      error: err.message,
    });
  }
};


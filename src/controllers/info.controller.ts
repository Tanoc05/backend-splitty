import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { supabase } from '../config/supabase.js';

export const getInfoItems = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { groupId, category } = req.query;

    let query = supabase.from('info_items').select(`
      *,
      creator:profiles!info_items_user_id_fkey (id, email, full_name, avatar_url)
    `);

    if (groupId) {
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
          message: 'Non sei autorizzato ad accedere alle informazioni di questo gruppo.',
        });
        return;
      }
      query = query.eq('group_id', groupId);
    } else {
      // Personal items for current user
      query = query.eq('user_id', userId).is('group_id', null);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data: items, error } = await query
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recupero delle informazioni salvate.',
        error: error.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore del server durante il recupero dei dati.',
      error: err.message,
    });
  }
};

export const createInfoItem = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { group_id, title, category, content, metadata, is_pinned } = req.body;

    if (group_id) {
      const { data: member } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!member) {
        res.status(403).json({
          success: false,
          message: 'Non fai parte di questo gruppo.',
        });
        return;
      }
    }

    const { data: item, error } = await supabase
      .from('info_items')
      .insert({
        group_id: group_id || null,
        user_id: userId,
        title,
        category: category || 'note',
        content,
        metadata: metadata || {},
        is_pinned: is_pinned ?? false,
      })
      .select(`
        *,
        creator:profiles!info_items_user_id_fkey (id, email, full_name, avatar_url)
      `)
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        message: 'Errore durante il salvataggio delle informazioni.',
        error: error.message,
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Elemento informativo salvato con successo.',
      data: item,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore durante la creazione del record.',
      error: err.message,
    });
  }
};

export const updateInfoItem = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { title, category, content, metadata, is_pinned } = req.body;

    // Verify ownership
    const { data: item } = await supabase
      .from('info_items')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (!item) {
      res.status(404).json({ success: false, message: 'Elemento non trovato.' });
      return;
    }

    if (item.user_id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Puoi modificare solo le informazioni create da te.',
      });
      return;
    }

    const { data: updatedItem, error } = await supabase
      .from('info_items')
      .update({
        ...(title !== undefined && { title }),
        ...(category !== undefined && { category }),
        ...(content !== undefined && { content }),
        ...(metadata !== undefined && { metadata }),
        ...(is_pinned !== undefined && { is_pinned }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        message: 'Errore durante l\'aggiornamento.',
        error: error.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Elemento aggiornato con successo.',
      data: updatedItem,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore durante l\'aggiornamento del record.',
      error: err.message,
    });
  }
};

export const deleteInfoItem = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { data: item } = await supabase
      .from('info_items')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (!item) {
      res.status(404).json({ success: false, message: 'Elemento non trovato.' });
      return;
    }

    if (item.user_id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Puoi eliminare solo le informazioni create da te.',
      });
      return;
    }

    await supabase.from('info_items').delete().eq('id', id);

    res.status(200).json({
      success: true,
      message: 'Elemento eliminato con successo.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore durante l\'eliminazione del record.',
      error: err.message,
    });
  }
};


import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { supabase } from '../config/supabase.js';

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      res.status(404).json({
        success: false,
        message: 'Profilo utente non trovato.',
        error: error.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero del profilo.',
      error: err.message,
    });
  }
};

export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { full_name, avatar_url } = req.body;

    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({
        ...(full_name !== undefined && { full_name }),
        ...(avatar_url !== undefined && { avatar_url }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Errore durante l\'aggiornamento del profilo.',
        error: error.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profilo aggiornato con successo.',
      data: updatedProfile,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Errore durante l\'aggiornamento del profilo.',
      error: err.message,
    });
  }
};

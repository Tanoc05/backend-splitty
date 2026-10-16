import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { supabase } from '../config/supabase.js';

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Header di autorizzazione mancante o formato Bearer non valido.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token Bearer non fornito.',
      });
      return;
    }

    // Verify token with Supabase Auth
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        success: false,
        message: 'Sessione o token Supabase non valido o scaduto.',
        error: error?.message,
      });
      return;
    }

    const supabaseUser = data.user;
    const metadata = supabaseUser.user_metadata || {};
    const fullName = metadata.full_name || metadata.name || '';
    const avatarUrl = metadata.avatar_url || '';

    // Ensure user profile exists in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .upsert(
        {
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          full_name: fullName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    req.user = {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      full_name: profile?.full_name || fullName,
      avatar_url: profile?.avatar_url || avatarUrl,
    };

    next();
  } catch (err: any) {
    console.error('[Auth Middleware Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Errore interno durante la verifica del token di autenticazione.',
      error: err.message,
    });
  }
};


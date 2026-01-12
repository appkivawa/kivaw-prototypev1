-- Create admin_roles table for role-based access control
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'support')),
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all roles
CREATE POLICY "Admins can view all roles" ON public.admin_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
      AND ar.role IN ('owner', 'admin')
    )
  );

-- Policy: Owners and admins can insert roles
CREATE POLICY "Owners and admins can insert roles" ON public.admin_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
      AND ar.role IN ('owner', 'admin')
    )
  );

-- Policy: Owners can update roles
CREATE POLICY "Owners can update roles" ON public.admin_roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
      AND ar.role = 'owner'
    )
  );

-- Create index
CREATE INDEX idx_admin_roles_user_id ON public.admin_roles (user_id);
CREATE INDEX idx_admin_roles_role ON public.admin_roles (role);

-- Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
      AND ar.role IN ('owner', 'admin', 'editor')
    )
  );

-- Create index for audit log queries
CREATE INDEX idx_audit_log_user_id ON public.audit_log (user_id);
CREATE INDEX idx_audit_log_resource ON public.audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_log_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Insert audit log entry
  INSERT INTO public.audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    changes
  ) VALUES (
    v_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_changes
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key TEXT UNIQUE NOT NULL,
  flag_value BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage feature flags
CREATE POLICY "Admins can manage feature flags" ON public.feature_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
      AND ar.role IN ('owner', 'admin')
    )
  );

-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage system settings
CREATE POLICY "Admins can manage system settings" ON public.system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
      AND ar.role IN ('owner', 'admin')
    )
  );

-- Create user_reports table for support tickets
CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  report_type TEXT NOT NULL,
  content_id TEXT,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create reports
CREATE POLICY "Users can create reports" ON public.user_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own reports
CREATE POLICY "Users can view their own reports" ON public.user_reports
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Support staff can view all reports
CREATE POLICY "Support can view all reports" ON public.user_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
      AND ar.role IN ('owner', 'admin', 'support')
    )
  );

-- Create admin_notes table for internal user notes
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view/manage notes
CREATE POLICY "Admins can manage notes" ON public.admin_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
      AND ar.role IN ('owner', 'admin', 'support')
    )
  );


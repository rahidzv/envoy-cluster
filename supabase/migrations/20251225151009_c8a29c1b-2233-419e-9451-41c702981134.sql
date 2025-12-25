-- Add email_confirmed_at tracking to profiles (for verification enforcement)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Create function to enforce max 3 bots per user
CREATE OR REPLACE FUNCTION public.check_bot_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bot_count INTEGER;
  max_bots INTEGER := 3;
BEGIN
  SELECT COUNT(*) INTO bot_count
  FROM public.bots
  WHERE user_id = NEW.user_id;
  
  IF bot_count >= max_bots THEN
    RAISE EXCEPTION 'Bot limit exceeded. Maximum % bots allowed per user.', max_bots;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce bot limit on insert
DROP TRIGGER IF EXISTS enforce_bot_limit ON public.bots;
CREATE TRIGGER enforce_bot_limit
  BEFORE INSERT ON public.bots
  FOR EACH ROW
  EXECUTE FUNCTION public.check_bot_limit();

-- Create function to validate resource limits
CREATE OR REPLACE FUNCTION public.validate_resource_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enforce CPU limit (0-10% representing 0.1 vCPU max)
  IF NEW.cpu_usage IS NOT NULL AND NEW.cpu_usage > 10 THEN
    NEW.cpu_usage := 10;
  END IF;
  
  -- Enforce memory limit (50MB max)
  IF NEW.memory_usage IS NOT NULL AND NEW.memory_usage > 50 THEN
    NEW.memory_usage := 50;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce resource limits
DROP TRIGGER IF EXISTS enforce_resource_limits ON public.bots;
CREATE TRIGGER enforce_resource_limits
  BEFORE INSERT OR UPDATE ON public.bots
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_resource_limits();

-- Enable realtime for bot_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_logs;
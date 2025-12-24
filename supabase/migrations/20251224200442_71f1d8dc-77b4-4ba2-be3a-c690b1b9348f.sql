-- Create enum for bot platforms
CREATE TYPE public.bot_platform AS ENUM ('telegram', 'discord');

-- Create enum for bot runtime
CREATE TYPE public.bot_runtime AS ENUM ('python', 'nodejs', 'php');

-- Create enum for bot status
CREATE TYPE public.bot_status AS ENUM ('online', 'offline', 'deploying', 'error', 'stopped');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Create bots table
CREATE TABLE public.bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  platform bot_platform NOT NULL,
  runtime bot_runtime NOT NULL,
  status bot_status NOT NULL DEFAULT 'offline',
  container_id TEXT,
  script_content TEXT,
  cpu_usage REAL DEFAULT 0,
  memory_usage REAL DEFAULT 0,
  uptime_seconds INTEGER DEFAULT 0,
  last_started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create environment variables table
CREATE TABLE public.bot_env_vars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bot activity logs table
CREATE TABLE public.bot_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create resource usage history for charts
CREATE TABLE public.resource_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE NOT NULL,
  cpu_usage REAL NOT NULL DEFAULT 0,
  memory_usage REAL NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_env_vars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_history ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Bots policies
CREATE POLICY "Users can view their own bots"
  ON public.bots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bots"
  ON public.bots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bots"
  ON public.bots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bots"
  ON public.bots FOR DELETE
  USING (auth.uid() = user_id);

-- Bot env vars policies
CREATE POLICY "Users can view env vars of their bots"
  ON public.bot_env_vars FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bots WHERE bots.id = bot_env_vars.bot_id AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can create env vars for their bots"
  ON public.bot_env_vars FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bots WHERE bots.id = bot_env_vars.bot_id AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can update env vars of their bots"
  ON public.bot_env_vars FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.bots WHERE bots.id = bot_env_vars.bot_id AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete env vars of their bots"
  ON public.bot_env_vars FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.bots WHERE bots.id = bot_env_vars.bot_id AND bots.user_id = auth.uid()
  ));

-- Bot logs policies
CREATE POLICY "Users can view logs of their bots"
  ON public.bot_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bots WHERE bots.id = bot_logs.bot_id AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert logs for their bots"
  ON public.bot_logs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bots WHERE bots.id = bot_logs.bot_id AND bots.user_id = auth.uid()
  ));

-- Resource history policies
CREATE POLICY "Users can view resource history of their bots"
  ON public.resource_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bots WHERE bots.id = resource_history.bot_id AND bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert resource history for their bots"
  ON public.resource_history FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bots WHERE bots.id = resource_history.bot_id AND bots.user_id = auth.uid()
  ));

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bots_updated_at
  BEFORE UPDATE ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.steam_accounts (
 user_id uuid PRIMARY KEY,
 steam_id text NOT NULL UNIQUE CHECK (steam_id ~ '^7656119[0-9]{10}$'),
 username text,
 avatar_url text,
 profile_url text NOT NULL,
 profile_status text NOT NULL DEFAULT 'unavailable',
 connected_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.steam_accounts TO authenticated;
GRANT ALL ON public.steam_accounts TO service_role;
ALTER TABLE public.steam_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own connected Steam account" ON public.steam_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Disconnect own Steam account" ON public.steam_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TABLE public.steam_link_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 token_hash text NOT NULL,
 origin text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.steam_link_attempts TO service_role;
ALTER TABLE public.steam_link_attempts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.steam_openid_nonces (
 nonce text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.steam_openid_nonces TO service_role;
ALTER TABLE public.steam_openid_nonces ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_steam_link_attempt(attempt_id uuid, expected_token_hash text, response_nonce text)
RETURNS TABLE (linked_user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE account_user uuid;
BEGIN
 UPDATE public.steam_link_attempts SET consumed_at = now()
 WHERE id = attempt_id AND token_hash = expected_token_hash AND consumed_at IS NULL AND expires_at > now()
 RETURNING user_id INTO account_user;
 IF account_user IS NULL THEN RAISE EXCEPTION 'Steam login attempt expired or already used'; END IF;
 INSERT INTO public.steam_openid_nonces(nonce) VALUES(response_nonce);
 RETURN QUERY SELECT account_user;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_steam_link_attempt(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_steam_link_attempt(uuid, text, text) TO service_role;